import { ApiError } from "@cbpupsis/shared/api";
import type { ReactNode } from "react";
import { AdminPage, ApiFailure } from "../../components/AdminPage";
import { useCatalogAccess } from "./useCatalogAccess";

export function CatalogAccess({ children }: { children: ReactNode }) {
  const access = useCatalogAccess();
  if (access.readable) return children;
  return (
    <AdminPage
      title="Course catalog"
      description="Courses, curricula, sections, and substitutions."
    >
      {!access.eligible ||
      (access.query.error instanceof ApiError && access.query.error.status === 403) ? (
        <p role="alert">This page is not available to your role.</p>
      ) : access.query.isError ? (
        <ApiFailure error={access.query.error} retry={() => void access.query.refetch()} />
      ) : (
        <p role="status">Checking catalog access…</p>
      )}
    </AdminPage>
  );
}
