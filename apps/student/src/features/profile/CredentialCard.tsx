import { AvatarUpload } from "./AvatarUpload";
import type { StudentCredentials } from "./profileTypes";

function CredentialField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-brand-muted text-xs">{label}</dt>
      <dd className="text-brand-ink mt-0.5 text-sm font-bold">{value}</dd>
    </div>
  );
}

interface CredentialCardProps {
  credentials: StudentCredentials;
  /** The student's full legal name from PersonalInformation. */
  fullName: string;
  onAvatarConfirm: (image: Blob) => Promise<void>;
}

export function CredentialCard({ credentials, fullName, onAvatarConfirm }: CredentialCardProps) {
  return (
    <div className="border-brand-border/25 flex flex-col gap-6 rounded-2xl border bg-white p-6 shadow-sm md:flex-row md:items-center">
      {/* Left: avatar */}
      <div className="flex shrink-0 justify-center md:justify-start">
        <AvatarUpload avatarUrl={credentials.avatarUrl} onConfirm={onAvatarConfirm} />
      </div>

      {/* Right: credential details */}
      <div className="min-w-0 flex-1">
        <p className="text-brand-maroon text-sm font-semibold tracking-wide">
          Institutional Credentials
        </p>

        <h2 className="text-brand-ink mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          {fullName}
        </h2>

        <p className="text-brand-muted mt-0.5 text-sm">{credentials.officialEmail}</p>

        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4">
          <CredentialField label="Student ID" value={credentials.studentId} />
          <CredentialField label="Admission Year" value={String(credentials.admissionYear)} />
          <CredentialField label="Program" value={credentials.program} />
          <CredentialField label="Enrollment Status" value={credentials.enrollmentStatus} />
        </dl>
      </div>
    </div>
  );
}
