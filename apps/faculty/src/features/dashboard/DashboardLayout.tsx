import { SignOutButton } from "@cbpupsis/account";
import {
  DashboardIcon,
  DashboardProfileCard,
  DashboardLayout as PortalDashboardLayout,
} from "@cbpupsis/ui";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useMe } from "../sign-in/useFacultyAuth";
import { useProfile } from "./queries";

/** Portal navigation and account wiring, separate from the dashboard page like student. */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const me = useMe();
  const profile = useProfile(me.isSuccess);
  const name = profile.data?.full_name?.trim() || profile.data?.display_name?.trim() || "Faculty";
  const settingsLink =
    "focus-visible:outline-brand-gold! flex min-h-11 items-center py-2.5 pr-4 pl-12 text-sm text-white/85 hover:bg-white/10";

  return (
    <PortalDashboardLayout
      portal="Faculty"
      homeLink={(className, children) => (
        <Link to="/dashboard" className={className}>
          {children}
        </Link>
      )}
      navigation={[
        ...[
          {
            label: "Grade corrections",
            icon: <DashboardIcon name="briefcase" />,
            children: [
              {
                label: "Correction of Entry",
                content: (
                  <Link to="/grade-corrections" className={settingsLink}>
                    Correction of Entry
                  </Link>
                ),
              },
            ],
          },
        ],
        {
          label: "Courses",
          icon: <DashboardIcon name="book" />,
          children: [{ label: "Assigned Courses" }],
        },
        {
          label: "Grades",
          icon: <DashboardIcon name="briefcase" />,
          children: [
            {
              label: "Grade Submission",
              content: (
                <Link to="/grades" className={settingsLink}>
                  Grade Submission
                </Link>
              ),
            },
            {
              label: "Incomplete grades",
              content: (
                <Link to="/incompletes" className={settingsLink}>
                  Incomplete grades
                </Link>
              ),
            },
          ],
        },
        {
          label: "Settings",
          icon: <DashboardIcon name="settings" />,
          children: [
            {
              label: "Change Password",
              content: (
                <Link to="/change-password" className={settingsLink}>
                  Change Password
                </Link>
              ),
            },
          ],
        },
      ]}
      account={(expanded) => (
        <DashboardProfileCard
          expanded={expanded}
          name={name}
          email={profile.data?.email ?? me.data?.email}
          loading={me.isPending || (me.isSuccess && profile.isPending)}
          error={profile.isError}
          onRetry={() => void profile.refetch()}
          signOut={
            <SignOutButton className="focus-visible:outline-brand-gold! grid size-11 shrink-0 place-items-center rounded-lg text-white hover:bg-white/10">
              <DashboardIcon name="signout" />
              <span className="sr-only">Sign out</span>
            </SignOutButton>
          }
        />
      )}
    >
      {children}
    </PortalDashboardLayout>
  );
}
