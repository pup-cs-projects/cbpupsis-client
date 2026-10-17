import { useMe } from "../sign-in/queries";

export interface DashboardUser {
  /** Derived from email local-part until a /profile endpoint exposes the full name. */
  displayName: string;
  email: string | null;
  /** Not yet returned by /auth/student/me; null until a profile endpoint exposes it. */
  studentNumber: string | null;
  isLoading: boolean;
}

function nameFromEmail(email: string): string {
  return email
    .split("@")[0]
    .split(/[._-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const FALLBACK: DashboardUser = {
  displayName: "Student",
  email: null,
  studentNumber: null,
  isLoading: false,
};

export function useDashboardUser(): DashboardUser {
  const me = useMe();
  if (me.isPending) return { ...FALLBACK, isLoading: true };
  if (!me.data) return FALLBACK;
  return {
    displayName: nameFromEmail(me.data.email),
    email: me.data.email,
    studentNumber: null,
    isLoading: false,
  };
}
