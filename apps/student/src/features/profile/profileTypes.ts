export interface StudentCredentials {
  studentId: string;
  admissionYear: number;
  program: string;
  enrollmentStatus: string;
  officialEmail: string;
  avatarUrl: string | null;
}

/**
 * What the form edits, under the API's own field names. `fullLegalName` and `program` are
 * locked: only the registrar changes them.
 */
export interface PersonalInformation {
  readonly fullLegalName: string;
  readonly program: string;
  phone: string;
  emailAddress: string;
  permanentAddress: string;
  currentAddress: string;
}

/** The profile fields a student edits; an address is `null` while its picker is half-filled. */
export type PersonalInfoKey = "phone" | "emailAddress" | "permanentAddress" | "currentAddress";

/** An emergency contact as the screen holds it: unset email and address are empty strings. */
export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  address: string;
  isPrimary: boolean;
}

/** What the contact form submits; the API assigns the id. */
export type EmergencyContactDraft = Omit<EmergencyContact, "id">;

export interface StudentProfileData {
  credentials: StudentCredentials;
  personalInfo: PersonalInformation;
  emergencyContacts: EmergencyContact[];
}
