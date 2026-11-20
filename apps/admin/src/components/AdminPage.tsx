// Scrollable table regions need keyboard focus at narrow viewport widths.
/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", { "roles": ["region"] }] */
import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import { useMe } from "../features/sign-in/useAdminAuth";

import { DashboardLayout } from "../features/dashboard/DashboardLayout";
import { adminApiMessage } from "../lib/adminApi";

export const adminField =
  "admin-field border-brand-input-border focus-visible:outline-offset-0! min-h-11 w-full min-w-0 rounded-lg border bg-white px-3.5 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-brand-paper disabled:text-brand-muted";
export const adminButton =
  "admin-button border-brand-border/40 hover:border-brand-maroon hover:bg-brand-maroon/5 focus-visible:outline-offset-0! inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
export const adminPrimary =
  adminButton + " border-brand-maroon! bg-brand-maroon! text-white hover:bg-brand-maroon-dark!";
export const adminCard =
  "admin-card border-brand-border/25 min-w-0 rounded-xl border bg-white p-5 sm:p-6";
export const adminPage =
  "admin-page mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10";
export const uuidPattern =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/** A consistent heading and action area across the admin workspaces. */
export function AdminPageHeader({
  title,
  description,
  eyebrow = "Administration",
  id,
  actions,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  id?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-page-header border-brand-border/20 flex flex-wrap items-end justify-between gap-5 border-b pb-6">
      <div className="max-w-3xl min-w-0">
        <p className="text-brand-muted mb-2 text-xs font-semibold">{eyebrow}</p>
        <h1
          id={id}
          className="text-brand-maroon text-3xl leading-tight font-bold tracking-tight sm:text-4xl"
        >
          {title}
        </h1>
        <p className="text-brand-muted mt-2 text-sm leading-relaxed">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function AdminPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const me = useMe();
  return (
    <DashboardLayout>
      <div className={adminPage}>
        <AdminPageHeader title={title} description={description} />
        {me.isError ? (
          <ApiFailure error={me.error} retry={() => void me.refetch()} />
        ) : me.isSuccess ? (
          children
        ) : (
          <p role="status">Loading admin account…</p>
        )}
      </div>
    </DashboardLayout>
  );
}
export function ApiFailure({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className={adminCard}>
      <p role="alert" className="text-brand-maroon text-sm">
        {adminApiMessage(error)}
      </p>
      {retry && (
        <button type="button" className={adminButton + " mt-4"} onClick={retry}>
          Retry
        </button>
      )}
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  return (
    <div className="block min-w-0 text-sm">
      <label htmlFor={id} className="mb-1.5 block font-semibold">
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  );
}
export function AdminTable({
  caption,
  headings,
  children,
}: {
  caption: string;
  headings: string[];
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="admin-table border-brand-border/25 focus-visible:outline-brand-maroon max-w-full overflow-x-auto rounded-xl border bg-white focus-visible:outline-2 focus-visible:outline-offset-0"
    >
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-brand-maroon text-white">
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col" className="px-4 py-3">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-brand-border/20 divide-y bg-white">{children}</tbody>
      </table>
    </div>
  );
}
export function Pagination({
  offset,
  total,
  limit = 20,
  busy = false,
  onChange,
}: {
  offset: number;
  total: number;
  limit?: number;
  busy?: boolean;
  onChange: (offset: number) => void;
}) {
  return (
    <nav aria-label="Results pages" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-brand-muted text-sm">
        {total ? `${offset + 1}–${Math.min(offset + limit, total)} of ${total}` : "0 records"}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={adminButton}
          disabled={busy || offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </button>
        <button
          type="button"
          className={adminButton}
          disabled={busy || offset + limit >= total}
          onClick={() => onChange(offset + limit)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
