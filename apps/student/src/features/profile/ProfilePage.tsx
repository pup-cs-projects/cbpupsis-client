import { ErrorAlert } from "@cbpupsis/ui";

import { DashboardLayout } from "../dashboard/DashboardLayout";
import { CredentialCard } from "./CredentialCard";
import { EmergencyContactsSection } from "./EmergencyContactsSection";
import { PersonalInfoSection } from "./PersonalInfoSection";
import { useStudentProfile } from "./useStudentProfile";

export function ProfilePage() {
  const {
    data,
    loading,
    error,
    retry,
    updateAvatar,
    updatePersonalInfo,
    saveEmergencyContact,
    deleteEmergencyContact,
  } = useStudentProfile();

  return (
    <DashboardLayout>
      <div className="space-y-8 px-4 py-8 sm:px-8">
        {/* Page header */}
        <div>
          <h1 className="text-brand-maroon text-3xl font-bold tracking-tight sm:text-4xl">
            Student Profile
          </h1>
          <p className="text-brand-muted mt-2 max-w-3xl text-sm leading-relaxed">
            View and manage your official institutional information. Ensure your contact details are
            up to date for university correspondence.
          </p>
        </div>

        {loading && (
          <p role="status" className="text-brand-muted text-sm">
            Loading your profile…
          </p>
        )}
        {!loading && !data && (
          <ErrorAlert error={error} title="Your profile could not be loaded" onRetry={retry} />
        )}

        {data && (
          <>
            {/* Institutional credentials + avatar */}
            <CredentialCard
              credentials={data.credentials}
              fullName={data.personalInfo.fullLegalName}
              onAvatarConfirm={updateAvatar}
            />

            {/* Personal information form */}
            <PersonalInfoSection info={data.personalInfo} onSave={updatePersonalInfo} />

            {/* Emergency contacts */}
            <EmergencyContactsSection
              contacts={data.emergencyContacts}
              onSave={saveEmergencyContact}
              onDelete={deleteEmergencyContact}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
