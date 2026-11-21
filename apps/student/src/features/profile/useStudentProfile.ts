import type {
  EmergencyContactInput,
  ProfileUpdate,
  StudentProfile,
} from "@cbpupsis/shared/profile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi, profileApi, session } from "../../lib/auth";
import { dashboardKeys } from "../dashboard/queries";
import type { Dashboard } from "../dashboard/types";
import type { EmergencyContact, PersonalInformation, StudentProfileData } from "./profileTypes";
import { profileKeys, profileQueryOptions, useAvatarSrc } from "./useAvatar";

type PersonalInfoPatch = Omit<PersonalInformation, "fullLegalName" | "program">;

/** The API takes +639XXXXXXXXX or 09XXXXXXXXX only; the form also allows spaces and dashes. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, "");
}

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

function toContactInput(contact: EmergencyContact): EmergencyContactInput {
  return {
    name: contact.fullName.trim(),
    relationship: contact.relationship.trim(),
    phone: normalizePhone(contact.phoneNumber),
    email: contact.email.trim() || null,
    address: contact.address.trim() || null,
    isPrimary: contact.isPrimary,
  };
}

function sameContact(a: EmergencyContact, b: EmergencyContact): boolean {
  return (
    a.fullName === b.fullName &&
    a.relationship === b.relationship &&
    a.phoneNumber === b.phoneNumber &&
    a.email === b.email &&
    a.address === b.address &&
    a.isPrimary === b.isPrimary
  );
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

  const saveContacts = useMutation({
    mutationFn: async ({
      original,
      next,
    }: {
      original: EmergencyContact[];
      next: EmergencyContact[];
    }) => {
      const kept = new Set(next.map((c) => c.id));
      const removed = original.filter((c) => !kept.has(c.id));
      const added = next.filter((c) => !original.some((o) => o.id === c.id));
      const changed = next.filter((c) => {
        const before = original.find((o) => o.id === c.id);
        return before !== undefined && !sameContact(before, c);
      });
      // The API keeps exactly one primary, demoting the others whenever one is set. Writing the
      // new primary last means the API ends in the state the student saw in the form.
      const writes = [...changed, ...added].sort(
        (a, b) => Number(a.isPrimary) - Number(b.isPrimary),
      );

      await session.authorized(async (token) => {
        for (const c of removed) await profileApi.deleteContact(token, c.id);
        for (const c of writes) {
          if (added.includes(c)) await profileApi.createContact(token, toContactInput(c));
          else await profileApi.updateContact(token, c.id, toContactInput(c));
        }
      });
    },
    // Refetch even after a partial failure, so the list shows what the API actually holds.
    onSettled: () => queryClient.invalidateQueries({ queryKey: profileKeys.contacts() }),
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
        phoneNumber: text(p, "phone"),
        personalEmail: text(p, "email"),
        homeAddress: text(p, "permanentAddress"),
        currentResidence: text(p, "currentAddress"),
      },
      emergencyContacts: contacts.data.map((c) => ({
        id: c.id,
        fullName: c.name,
        relationship: c.relationship,
        phoneNumber: c.phone,
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
      if (patch.phoneNumber !== info?.phoneNumber) {
        changes.phone = normalizePhone(patch.phoneNumber);
      }
      if (patch.personalEmail !== info?.personalEmail) changes.email = patch.personalEmail.trim();
      if (patch.homeAddress !== info?.homeAddress) {
        changes.permanentAddress = patch.homeAddress.trim();
      }
      if (patch.currentResidence !== info?.currentResidence) {
        changes.currentAddress = patch.currentResidence.trim();
      }
      if (Object.keys(changes).length === 0) return;
      await updatePersonalInfo.mutateAsync(changes);
    },

    async updateAvatar(image: Blob): Promise<void> {
      await uploadAvatar.mutateAsync(image);
    },

    async setAllEmergencyContacts(next: EmergencyContact[]): Promise<void> {
      await saveContacts.mutateAsync({ original: data?.emergencyContacts ?? [], next });
    },
  };
}
