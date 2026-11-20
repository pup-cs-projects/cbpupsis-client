import { CorrectionWorkspace } from "@cbpupsis/ui/corrections";
import type { CorrectionSource } from "@cbpupsis/shared/grades/corrections";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { AdminPageHeader, adminPage } from "../../components/AdminPage";
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
      <div className={adminPage}>
        <AdminPageHeader
          eyebrow="Academics / Grades"
          title="Correction of Entry"
          description="Review corrections in your scope. Chair, Dean, and Registrar act in sequence."
        />
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
