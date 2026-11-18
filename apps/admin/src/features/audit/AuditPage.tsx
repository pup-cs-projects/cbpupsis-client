import { AdminPage, adminCard } from "../../components/AdminPage";
export function AuditPage() {
  return (
    <AdminPage title="Audit logs" description="Audit trail access.">
      <p role="alert" className={adminCard}>
        The full audit trail is not available to your admin role. Enrollment-request activity is
        available on the dashboard.
      </p>
    </AdminPage>
  );
}
