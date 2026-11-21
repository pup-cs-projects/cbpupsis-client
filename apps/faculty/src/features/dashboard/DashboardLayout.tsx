import { SignOutButton } from "@cbpupsis/account";
import {
  DashboardHeader,
  DashboardIcon,
  DashboardProfileCard,
  DashboardLayout as PortalDashboardLayout,
} from "@cbpupsis/ui";
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useMe } from "../sign-in/useFacultyAuth";
import { useProfile } from "./queries";

/** Portal navigation and account wiring, separate from the dashboard page like student. */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const me = useMe();
  const pathname = useLocation({ select: (location) => location.pathname });
  const activeSection =
    pathname.startsWith("/profile") || pathname.startsWith("/change-password")
      ? "Settings"
      : pathname.startsWith("/grade-corrections")
        ? "Forms & Requests"
        : pathname.startsWith("/grades") || pathname.startsWith("/incompletes")
          ? "Grades"
          : pathname.startsWith("/sections")
            ? "Academics"
            : undefined;
  const profile = useProfile(me.isSuccess);
  const name = profile.data?.full_name?.trim() || profile.data?.display_name?.trim() || "Faculty";
  const settingsLink =
    "focus-visible:outline-brand-gold! flex min-h-11 items-center py-2.5 pr-4 pl-12 text-sm text-white/85 hover:bg-white/10 aria-[current=page]:bg-white/15";

  return (
    <PortalDashboardLayout
      portal="Faculty"
      activeSection={activeSection}
      headerTools={
        <DashboardHeader
          name={name}
          email={profile.data?.email ?? me.data?.email}
          identifier={me.data?.employeeId}
          profileLink={(className, children) => (
            <Link to="/profile" className={className}>
              {children}
            </Link>
          )}
          passwordLink={(className, children) => (
            <Link to="/change-password" className={className}>
              {children}
            </Link>
          )}
          notificationsLink={(className, children) => (
            <Link to="/dashboard" hash="faculty-notifications" className={className}>
              {children}
            </Link>
          )}
          signOut={
            <SignOutButton className="flex min-h-11 w-full cursor-pointer items-center px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">
              Logout
            </SignOutButton>
          }
        />
      }
      profileLink={(className, children) => (
        <Link to="/profile" className={className}>
          {children}
        </Link>
      )}
      notificationsLink={(className, children) => (
        <Link to="/dashboard" hash="faculty-notifications" className={className}>
          {children}
        </Link>
      )}
      homeLink={(className, children) => (
        <Link to="/dashboard" className={className}>
          {children}
        </Link>
      )}
      navigation={[
        {
          label: "Academics",
          icon: <DashboardIcon name="academics" />,
          children: [
            {
              label: "Assigned sections",
              content: (
                <Link to="/sections" className={settingsLink}>
                  Assigned sections
                </Link>
              ),
            },
          ],
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
          label: "Forms & Requests",
          icon: <DashboardIcon name="mail" />,
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
        {
          label: "Settings",
          icon: <DashboardIcon name="settings" />,
          children: [
            {
              label: "Account settings",
              content: (
                <Link to="/profile" activeOptions={{ includeHash: true }} className={settingsLink}>
                  Account settings
                </Link>
              ),
            },
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
        {
          label: "Help & Support",
          icon: <DashboardIcon name="help" />,
          href: "mailto:icto-admin@pup.edu.ph",
          children: [],
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
