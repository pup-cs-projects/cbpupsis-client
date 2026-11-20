import { Link } from "@tanstack/react-router";
import { AdminPage, adminCard, adminButton } from "../../components/AdminPage";
import { useMe } from "../sign-in/useAdminAuth";
import { adminScope, scopeLabel } from "./dataSource";

export function UserManagementPage() {
  const me = useMe();
  let scope = "No management access";
  if (me.data) {
    try {
      scope = scopeLabel(adminScope(me.data));
    } catch {
      /* Keep unavailable scope explicit. */
    }
  }
  if (me.isSuccess && scope === "No management access")
    return (
      <AdminPage title="User management" description="Student and faculty account management.">
        <p role="alert">This page is not available to your role.</p>
      </AdminPage>
    );
  return (
    <AdminPage
      title="User management"
      description="Student and faculty accounts, roles, and permissions."
    >
      <p className={adminCard + " text-sm font-semibold"}>{scope}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            title: "Student Management",
            to: "/users/students",
            description: "Student profiles, roles, and account permissions.",
          },
          {
            title: "Faculty Management",
            to: "/users/faculty",
            description: "Faculty profiles, roles, and account permissions.",
          },
        ].map((item) => (
          <section key={item.to} className={adminCard + " flex flex-col items-start gap-3"}>
            <h2 className="text-lg font-bold">{item.title}</h2>
            <p className="text-brand-muted grow text-sm leading-relaxed">{item.description}</p>
            <Link to={item.to} className={adminButton}>
              Open {item.title}
            </Link>
          </section>
        ))}
      </div>
    </AdminPage>
  );
}
