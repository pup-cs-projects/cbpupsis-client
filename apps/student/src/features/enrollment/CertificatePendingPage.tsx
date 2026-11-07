import { Link } from "@tanstack/react-router";

import "@cbpupsis/account/styles.css";
import { DashboardLayout } from "../dashboard/DashboardLayout";

/**
 * Where "View your Certificate of Registration" leads today. The certificate itself is
 * US-ENRL-003 (issue #43); this keeps the link real rather than dead until that screen lands.
 */
export function CertificatePendingPage() {
  return (
    <DashboardLayout>
      <div className="space-y-4 px-4 py-8 text-center sm:px-8">
        <h1 className="text-brand-maroon text-2xl font-bold">Certificate of Registration</h1>
        <p className="text-brand-muted mx-auto max-w-md text-sm">
          Your enrollment went through. This certificate is generating and will be available to view
          and download here soon.
        </p>
        <Link
          to="/enrollment"
          className="text-brand-crimson inline-flex min-h-11 items-center text-sm font-semibold hover:underline"
        >
          Back to Enrollment
        </Link>
      </div>
    </DashboardLayout>
  );
}
