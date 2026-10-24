import { useState } from "react";

import type { EmergencyContact, PersonalInformation, StudentProfileData } from "./profileTypes";

const INITIAL_DATA: StudentProfileData = {
  credentials: {
    studentId: "2021-00456-MN-0",
    admissionYear: 2021,
    program: "BS in Computer Science",
    enrollmentStatus: "Irregular",
    officialEmail: "juangpaeldona@iskolarngbayan.pup.edu.ph",
    avatarUrl: null,
  },
  personalInfo: {
    fullLegalName: "Juan A. Dela Cruz",
    program: "BS in Computer Science",
    phoneNumber: "+63 912 345 6789",
    personalEmail: "bamanobatayo@gmail.com",
    homeAddress: "123 Young Goat St., Brgy. Lebyearnjames, Biringan City, Samar",
    currentResidence: "Rm. 305, PUP Dormitory, Sta. Mesa, Manila",
  },
  emergencyContacts: [
    {
      id: "ec-1",
      fullName: "Maria Lourdes Pael Dona",
      relationship: "Mother",
      phoneNumber: "+63 917 123 4567",
      email: "maria.delacruz@email.com",
      address: "25 Mabini Street, Brgy. San Roque, Antipolo City, Rizal",
      isPrimary: true,
    },
    {
      id: "ec-2",
      fullName: "Nicole Jokic",
      relationship: "Class Representative",
      phoneNumber: "+63 976 345 7398",
      email: "nikolezjoke@email.com",
      address: "Sampaloc, Manila",
      isPrimary: false,
    },
  ],
};

export function useStudentProfile() {
  const [data, setData] = useState<StudentProfileData>(INITIAL_DATA);
  const [loading] = useState(false);
  const [error] = useState<Error | null>(null);

  function updatePersonalInfo(
    patch: Partial<Omit<PersonalInformation, "fullLegalName" | "program">>,
  ) {
    setData((prev) => ({
      ...prev,
      personalInfo: { ...prev.personalInfo, ...patch },
    }));
  }

  function setAllEmergencyContacts(contacts: EmergencyContact[]) {
    setData((prev) => ({ ...prev, emergencyContacts: contacts }));
  }

  function updateAvatarUrl(url: string) {
    setData((prev) => ({
      ...prev,
      credentials: { ...prev.credentials, avatarUrl: url },
    }));
  }

  return {
    data,
    loading,
    error,
    updatePersonalInfo,
    updateAvatarUrl,
    setAllEmergencyContacts,
  };
}
