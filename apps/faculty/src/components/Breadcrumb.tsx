import { Link, type LinkProps } from "@tanstack/react-router";

/** The page trail, named after the sidebar section and link, styled like the student portal. */
export function Breadcrumb({
  items,
}: {
  items: readonly { label: string; to?: LinkProps["to"] }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="print:hidden">
      <ol className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {index > 0 && <span aria-hidden="true">&gt;</span>}
              {last ? (
                <span aria-current="page" className="text-brand-ink font-semibold">
                  {item.label}
                </span>
              ) : item.to ? (
                <Link to={item.to} className="hover:text-brand-maroon underline">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
