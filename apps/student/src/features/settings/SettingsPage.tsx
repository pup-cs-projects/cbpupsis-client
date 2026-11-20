import { DashboardLayout } from "../dashboard/DashboardLayout";
import { ChangePasswordSection } from "./ChangePasswordSection";

/** Account preferences and security: the student's own password lives here. */
export function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8 px-4 py-8 sm:px-8">
        <div>
          <h1 className="text-brand-maroon text-3xl font-bold tracking-tight sm:text-4xl">
            Settings
          </h1>
          <p className="text-brand-muted mt-2 max-w-3xl text-sm leading-relaxed">
            Manage your account and keep it secure.
          </p>
        </div>

        <ChangePasswordSection />
      </div>
    </DashboardLayout>
  );
}
