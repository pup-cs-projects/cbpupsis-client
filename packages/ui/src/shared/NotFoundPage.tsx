import { StatusPageIcon } from "./StatusPageIcon";
import { StatusPageLayout, statusPrimaryAction } from "./StatusPageLayout";

export function NotFoundPage({ homeHref = "/" }: { homeHref?: string }) {
  return (
    <StatusPageLayout
      title="Page not found"
      code="404 · Not found"
      homeHref={homeHref}
      description={
        <>
          We couldn't find the page you're looking for.
          <br />
          Check the address or return to the portal.
        </>
      }
      icon={
        <StatusPageIcon>
          <circle cx="41" cy="41" r="25" />
          <path d="m60 60 21 21M33 33l16 16M49 33 33 49" />
        </StatusPageIcon>
      }
    >
      <a href={homeHref} className={statusPrimaryAction}>
        Back to Home
      </a>
    </StatusPageLayout>
  );
}
