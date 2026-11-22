import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

/** One field of the profile read: its value and whether the student may change it. */
export interface ProfileField {
  value: string | null;
  editable: boolean;
}

/** GET /student/profile (US-STU-002). Field names are the API's own. */
export interface StudentProfile {
  studentId: string;
  /** Relative to the API host (`/api/v1/student/profile/avatar/<id>`), or null. */
  avatarUrl: string | null;
  fields: Record<string, ProfileField>;
}

/**
 * The fields a student may change, under the API's own names. Anything else answers
 * 403 PROFILE_FIELD_LOCKED, so nothing but these four keys is ever sent.
 */
export interface ProfileUpdate {
  phone?: string;
  emailAddress?: string;
  permanentAddress?: string;
  currentAddress?: string;
}

/** A student keeps at most this many emergency contacts. */
export const MAX_EMERGENCY_CONTACTS = 3;

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  address: string | null;
  isPrimary: boolean;
}

export type EmergencyContactInput = Omit<EmergencyContact, "id">;

/** The four editable profile keys, in the order the form lists them. */
export const PROFILE_UPDATE_KEYS = [
  "phone",
  "emailAddress",
  "permanentAddress",
  "currentAddress",
] as const;

/** Copies only the keys the API takes, so a stray property can never reach the request body. */
function profileBody(changes: ProfileUpdate): ProfileUpdate {
  const body: ProfileUpdate = {};
  for (const key of PROFILE_UPDATE_KEYS) {
    const value = changes[key];
    if (value !== undefined) body[key] = value;
  }
  return body;
}

function contactBody(contact: EmergencyContactInput): EmergencyContactInput {
  return {
    name: contact.name,
    relationship: contact.relationship,
    phone: contact.phone,
    email: contact.email,
    address: contact.address,
    isPrimary: contact.isPrimary,
  };
}

const PROFILE = "/student/profile";
const CONTACTS = `${PROFILE}/emergency-contacts`;

/** The student's own profile, picture, and emergency contacts. */
export function createStudentProfileApi(client: ApiClient) {
  return {
    async get(accessToken: string): Promise<StudentProfile> {
      return parseProfile(await client.request(PROFILE, { method: "GET", accessToken }));
    },

    async update(accessToken: string, changes: ProfileUpdate): Promise<StudentProfile> {
      const body = await client.request(PROFILE, {
        method: "PATCH",
        body: profileBody(changes),
        accessToken,
      });
      return parseProfile(body);
    },

    /** JPEG or PNG up to 5 MB; the API inspects the bytes, not the name or type. */
    async uploadAvatar(accessToken: string, image: Blob): Promise<string> {
      const form = new FormData();
      form.append("file", image, "avatar.jpg");
      const body = parse.record(
        await client.request(`${PROFILE}/avatar`, { body: form, accessToken }),
      );
      return parse.string(body.avatarUrl);
    },

    /**
     * The picture behind `avatarUrl`. It needs the bearer token, so an `<img src>` cannot load
     * it directly; the caller makes an object URL from the result.
     */
    async avatar(accessToken: string, avatarUrl: string): Promise<Blob> {
      return client.requestBlob(avatarPath(avatarUrl), { accessToken });
    },

    async contacts(accessToken: string): Promise<EmergencyContact[]> {
      const body = await client.request(CONTACTS, { method: "GET", accessToken });
      return parse.array(body).map(parseContact);
    },

    async createContact(
      accessToken: string,
      contact: EmergencyContactInput,
    ): Promise<EmergencyContact> {
      return parseContact(
        await client.request(CONTACTS, { body: contactBody(contact), accessToken }),
      );
    },

    async updateContact(
      accessToken: string,
      id: string,
      contact: EmergencyContactInput,
    ): Promise<EmergencyContact> {
      const body = await client.request(`${CONTACTS}/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: contactBody(contact),
        accessToken,
      });
      return parseContact(body);
    },

    async deleteContact(accessToken: string, id: string): Promise<void> {
      await client.request(`${CONTACTS}/${encodeURIComponent(id)}`, {
        method: "DELETE",
        accessToken,
      });
    },
  };
}

export type StudentProfileApi = ReturnType<typeof createStudentProfileApi>;

/** The API names the picture by its full path; the client's base URL already ends in /api/v1. */
function avatarPath(avatarUrl: string): string {
  const match = /\/student\/profile\/avatar\/[^/?#]+$/.exec(avatarUrl);
  return match ? match[0] : parse.invalid();
}

function parseProfile(value: unknown): StudentProfile {
  const body = parse.record(value);
  const rawFields = parse.record(body.fields);
  const fields: Record<string, ProfileField> = {};
  for (const [name, raw] of Object.entries(rawFields)) {
    const field = parse.record(raw);
    // Values are strings, except yearLevel, which arrives as a number.
    const value = field.value;
    fields[name] = {
      value:
        value === null || value === undefined
          ? null
          : typeof value === "string" || typeof value === "number"
            ? String(value)
            : parse.invalid(),
      editable: parse.boolean(field.editable),
    };
  }
  return {
    studentId: parse.string(body.studentId),
    avatarUrl: parse.optionalString(body.avatarUrl),
    fields,
  };
}

function parseContact(value: unknown): EmergencyContact {
  const body = parse.record(value);
  return {
    id: parse.string(body.id),
    name: parse.string(body.name),
    relationship: parse.string(body.relationship),
    phone: parse.string(body.phone),
    email: optionalText(body.email),
    address: optionalText(body.address),
    isPrimary: parse.boolean(body.isPrimary),
  };
}

/** Contacts may carry an empty string or null for an unset email or address. */
function optionalText(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "string" ? value : parse.invalid();
}
