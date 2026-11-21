import { StatusPageIcon } from "./StatusPageIcon";
import { StatusPageLayout, statusPrimaryAction } from "./StatusPageLayout";

export function MaintenancePage({
  homeHref = "/",
  schedule,
}: {
  homeHref?: string;
  schedule?: string;
}) {
  return (
    <StatusPageLayout
      title="Scheduled maintenance"
      code="503 · Temporarily unavailable"
      homeHref={homeHref}
      description={
        <>
          <p>The portal is temporarily unavailable while we make scheduled improvements.</p>
          <p className="mt-2">Thank you for your patience. Please check back shortly.</p>
          {schedule && (
            <p className="border-brand-border/30 bg-brand-paper mt-5 rounded-xl border px-4 py-3 text-sm font-semibold">
              {schedule}
            </p>
          )}
        </>
      }
      icon={
        <StatusPageIcon>
          <path d="M68 14a23 23 0 0 0-27 29L15 69a9 9 0 0 0 12 12l26-26a23 23 0 0 0 29-27L67 43 53 29l15-15Z" />
        </StatusPageIcon>
      }
    >
      <a href={homeHref} className={statusPrimaryAction}>
        Check Availability
      </a>
    </StatusPageLayout>
  );
}
