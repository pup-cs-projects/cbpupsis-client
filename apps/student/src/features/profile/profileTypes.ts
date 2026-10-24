export interface StudentCredentials {
  studentId: string;
  admissionYear: number;
  program: string;
  enrollmentStatus: string;
  officialEmail: string;
  avatarUrl: string | null;
}

/** fullLegalName and program are read-only (set by the registrar). */
export interface PersonalInformation {
  readonly fullLegalName: string;
  readonly program: string;
  phoneNumber: string;
  personalEmail: string;
  homeAddress: string;
  currentResidence: string;
}

export interface EmergencyContact {
  id: string;
  fullName: string;
  relationship: string;
  phoneNumber: string;
  email: string;
  address: string;
  isPrimary: boolean;
}

export interface StudentProfileData {
  credentials: StudentCredentials;
  personalInfo: PersonalInformation;
  emergencyContacts: EmergencyContact[];
}
