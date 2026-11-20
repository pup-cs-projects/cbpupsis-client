import { CorrectionWorkspace } from "@cbpupsis/ui/corrections";
import type { CorrectionSource } from "@cbpupsis/shared/grades/corrections";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { useMe } from "../sign-in/useAdminAuth";
import { correctionSource } from "./dataSource";
export function GradeCorrectionsPage({
  dataSource = correctionSource,
}: {
  dataSource?: CorrectionSource;
}) {
  const me = useMe();
  return (
    <DashboardLayout>
      <div className="space-y-6 px-4 py-8 sm:px-8">
        <header>
          <p className="text-brand-muted text-sm">Academics / Grades</p>
          <h1 className="text-brand-maroon mt-2 text-3xl font-bold">Correction of Entry</h1>
          <p className="text-brand-muted mt-2 max-w-2xl text-sm leading-relaxed">
            Review corrections in your scope. Chair, Dean, and Registrar act in sequence.
          </p>
        </header>
        {me.isPending ? (
          <p role="status">Checking your account…</p>
        ) : me.isError ? (
          <div role="alert">
            <p>Your account could not be loaded.</p>
            <button className="min-h-11 cursor-pointer underline" onClick={() => void me.refetch()}>
              Retry account
            </button>
          </div>
        ) : (
          <CorrectionWorkspace
            key={`${me.data.id}:${me.data.position}:${me.data.collegeId}:${me.data.departmentId}`}
            source={dataSource}
            ownerId={me.data.id}
            reviewerRole={me.data.position}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
