import { StatusPageIcon } from "./StatusPageIcon";
import { StatusPageLayout, statusPrimaryAction, statusSecondaryAction } from "./StatusPageLayout";

/** Error details are deliberately not rendered: server messages may contain private data. */
export function ServerErrorPage({
  homeHref = "/",
  onRetry,
}: {
  homeHref?: string;
  onRetry?: () => void;
}) {
  return (
    <StatusPageLayout
      title="Something went wrong on our side"
      code="500 · Server error"
      homeHref={homeHref}
      description={
        <>
          We're having trouble loading this page.
          <br />
          Please try again in a moment.
        </>
      }
      icon={
        <StatusPageIcon>
          <circle cx="48" cy="48" r="33" />
          <path d="m36 36 24 24M60 36 36 60M13 17l8-8M75 9l8 8" />
        </StatusPageIcon>
      }
    >
      <button
        type="button"
        className={statusPrimaryAction}
        onClick={onRetry ?? (() => window.location.reload())}
      >
        Try Again
      </button>
      <a href={homeHref} className={statusSecondaryAction}>
        Back to Home
      </a>
    </StatusPageLayout>
  );
}
