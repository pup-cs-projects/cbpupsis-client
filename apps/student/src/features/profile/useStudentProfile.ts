import type {
  EmergencyContact as ApiContact,
  EmergencyContactInput,
  ProfileUpdate,
  StudentProfile,
} from "@cbpupsis/shared/profile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi, profileApi, session } from "../../lib/auth";
import { dashboardKeys } from "../dashboard/queries";
import type { Dashboard } from "../dashboard/types";
import type {
  EmergencyContactDraft,
  PersonalInfoKey,
  PersonalInformation,
  StudentProfileData,
} from "./profileTypes";
import { normalizePhone } from "./profileValidation";
import { profileKeys, profileQueryOptions, useAvatarSrc } from "./useAvatar";

type PersonalInfoPatch = Pick<PersonalInformation, PersonalInfoKey>;

function text(profile: StudentProfile, name: string): string {
  return profile.fields[name]?.value ?? "";
}

/** `pending` -> `Pending`, `on_leave` -> `On Leave`. */
function titleCase(code: string): string {
  return code
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** Exactly the six keys the API takes for a contact, and nothing else. */
function toContactInput(contact: EmergencyContactDraft): EmergencyContactInput {
  return {
    name: contact.name.trim(),
    relationship: contact.relationship.trim(),
    phone: normalizePhone(contact.phone),
    email: contact.email.trim() || null,
    address: contact.address.trim() || null,
    isPrimary: contact.isPrimary,
  };
}

/**
 * The list after `saved` was written. The API keeps exactly one primary, demoting the others
 * whenever one is set, so the screen does the same without waiting for another read.
 */
function withSaved(list: ApiContact[], saved: ApiContact): ApiContact[] {
  const demoted = saved.isPrimary ? list.map((c) => ({ ...c, isPrimary: false })) : list;
  return demoted.some((c) => c.id === saved.id)
    ? demoted.map((c) => (c.id === saved.id ? saved : c))
    : [...demoted, saved];
}

export function useStudentProfile() {
  const queryClient = useQueryClient();

  const profile = useQuery(profileQueryOptions());
  // The institutional address the student signs in with; the profile's email is the personal one.
  const account = useQuery({
    queryKey: profileKeys.account(),
    queryFn: () => session.authorized(authApi.me),
  });
  // The profile read leaves out contacts' email and address (BR-AUTH-007); this read has them.
  const contacts = useQuery({
    queryKey: profileKeys.contacts(),
    queryFn: () => session.authorized((token) => profileApi.contacts(token)),
  });
  const avatarSrc = useAvatarSrc(profile.data?.avatarUrl ?? null);

  const updatePersonalInfo = useMutation({
    mutationFn: (changes: ProfileUpdate) =>
      session.authorized((token) => profileApi.update(token, changes)),
    onSuccess: (updated) => queryClient.setQueryData(profileKeys.profile(), updated),
  });

  const uploadAvatar = useMutation({
    mutationFn: (image: Blob) =>
      session.authorized((token) => profileApi.uploadAvatar(token, image)),
    onSuccess: (avatarUrl) => {
      // The header reads the profile (and the dashboard, as a fallback): give both the new
      // picture now, then refresh them.
      queryClient.setQueryData<StudentProfile>(profileKeys.profile(), (current) =>
        current ? { ...current, avatarUrl } : current,
      );
      queryClient.setQueryData<Dashboard>(dashboardKeys.me(), (dashboard) =>
        dashboard ? { ...dashboard, avatarUrl } : dashboard,
      );
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.me() });
      return queryClient.invalidateQueries({ queryKey: profileKeys.profile() });
    },
  });

  const saveContact = useMutation({
    mutationFn: ({ id, contact }: { id: string | null; contact: EmergencyContactDraft }) =>
      session.authorized((token) =>
        id === null
          ? profileApi.createContact(token, toContactInput(contact))
          : profileApi.updateContact(token, id, toContactInput(contact)),
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData<ApiContact[]>(profileKeys.contacts(), (list) =>
        withSaved(list ?? [], saved),
      );
    },
  });

  const deleteContact = useMutation({
    mutationFn: (id: string) => session.authorized((token) => profileApi.deleteContact(token, id)),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<ApiContact[]>(profileKeys.contacts(), (list) =>
        (list ?? []).filter((c) => c.id !== id),
      );
    },
  });

  let data: StudentProfileData | undefined;
  if (profile.data && contacts.data) {
    const p = profile.data;
    const fullLegalName = ["firstName", "middleName", "lastName"]
      .map((name) => text(p, name))
      .filter(Boolean)
      .join(" ");
    const program = text(p, "program");
    data = {
      credentials: {
        studentId: p.studentId,
        // A PUP student number starts with the year of admission: 2021-00456-MN-0.
        admissionYear: Number(p.studentId.slice(0, 4)),
        program,
        enrollmentStatus: titleCase(text(p, "enrollmentStatus")),
        officialEmail: account.data?.email ?? "",
        avatarUrl: avatarSrc,
      },
      personalInfo: {
        fullLegalName,
        program,
        phone: text(p, "phone"),
        emailAddress: text(p, "emailAddress"),
        permanentAddress: text(p, "permanentAddress"),
        currentAddress: text(p, "currentAddress"),
      },
      emergencyContacts: contacts.data.map((c) => ({
        id: c.id,
        name: c.name,
        relationship: c.relationship,
        phone: c.phone,
        email: c.email ?? "",
        address: c.address ?? "",
        isPrimary: c.isPrimary,
      })),
    };
  }

  return {
    data,
    loading: profile.isPending || contacts.isPending,
    error: profile.error ?? contacts.error,
    retry: () => {
      void profile.refetch();
      void contacts.refetch();
    },

    /** Sends only the fields that changed. Rejects with the API's error for the form to show. */
    async updatePersonalInfo(patch: PersonalInfoPatch): Promise<void> {
      const info = data?.personalInfo;
      const changes: ProfileUpdate = {};
      // Phone is optional. The API has no way to clear it, so an empty field sends nothing.
      if (
        normalizePhone(patch.phone) &&
        normalizePhone(patch.phone) !== normalizePhone(info?.phone ?? "")
      ) {
        changes.phone = normalizePhone(patch.phone);
      }
      if (patch.emailAddress !== info?.emailAddress) {
        changes.emailAddress = patch.emailAddress.trim();
      }
      if (patch.permanentAddress !== info?.permanentAddress) {
        changes.permanentAddress = patch.permanentAddress.trim();
      }
      if (patch.currentAddress !== info?.currentAddress) {
        changes.currentAddress = patch.currentAddress.trim();
      }
      if (Object.keys(changes).length === 0) return;
      await updatePersonalInfo.mutateAsync(changes);
    },

    async updateAvatar(image: Blob): Promise<void> {
      await uploadAvatar.mutateAsync(image);
    },

    /** Creates the contact when `id` is null, else updates it. Rejects with the API's error. */
    async saveEmergencyContact(id: string | null, contact: EmergencyContactDraft): Promise<void> {
      await saveContact.mutateAsync({ id, contact });
    },

    async deleteEmergencyContact(id: string): Promise<void> {
      await deleteContact.mutateAsync(id);
    },
  };
}
