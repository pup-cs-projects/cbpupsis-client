import { SignOutButton } from "@cbpupsis/account";
import {
  DashboardIcon,
  DashboardProfileCard,
  DashboardLayout as PortalDashboardLayout,
} from "@cbpupsis/ui";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useMe } from "../sign-in/useAdminAuth";
import { isReviewerRole } from "../enrollment-requests/reviewRules";
import { useCatalogAccess } from "../catalog/useCatalogAccess";
import { useReportAccess } from "../reports/reportAccess";
import { useProfile } from "./queries";

/** Portal navigation and account wiring, separate from the dashboard page like student. */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const me = useMe();
  const catalogAccess = useCatalogAccess();
  const reportAccess = useReportAccess();
  const profile = useProfile(me.isSuccess);
  const name = profile.data?.full_name?.trim() || profile.data?.display_name?.trim() || "Admin";
  const settingsLink =
    "admin-sidebar-link focus-visible:outline-brand-gold! flex min-h-11 w-full items-center py-2.5 pr-4 pl-12 text-sm text-white/90 hover:bg-white/10";

  return (
    <PortalDashboardLayout
      portal="Admin"
      homeLink={(className, children) => (
        <Link to="/dashboard" className={className}>
          {children}
        </Link>
      )}
      navigation={[
        {
          label: "Home",
          icon: <DashboardIcon name="home" />,
          children: [
            {
              label: "Overview",
              content: (
                <Link to="/dashboard" className={settingsLink}>
                  Overview
                </Link>
              ),
            },
          ],
        },
        ...(isReviewerRole(me.data?.position)
          ? [
              {
                label: "Users",
                icon: <DashboardIcon name="users" />,
                children: [
                  {
                    label: "User Management",
                  },
                ],
              },
            ]
          : []),
        ...(catalogAccess.readable || isReviewerRole(me.data?.position)
          ? [
              {
                label: "Academics",
                icon: <DashboardIcon name="mail" />,
                children: [
                  { label: "Calendar" },
                  ...(catalogAccess.readable
                    ? [
                        {
                          label: "Courses",
                        },
                      ]
                    : []),
                  ...(me.data?.position === "dean"
                    ? [
                        {
                          label: "INC completions",
                        },
                      ]
                    : []),
                  ...(isReviewerRole(me.data?.position)
                    ? [
                        {
                          label: "Enrollment requests",
                          content: (
                            <Link
                              to="/enrollment-requests"
                              className={settingsLink + " aria-[current=page]:bg-white/15"}
                            >
                              Enrollment requests
                            </Link>
                          ),
                        },
                      ]
                    : []),
                ],
              },
            ]
          : []),
        {
          label: "Reports",
          icon: <DashboardIcon name="briefcase" />,
          children: [
            { label: "User Management" },
            ...(reportAccess.allowed
              ? [
                  {
                    label: "Enrollment",
                  },
                ]
              : []),
            { label: "Financial" },
          ],
        },
        ...(isReviewerRole(me.data?.position)
          ? [
              {
                label: "Grade corrections",
                icon: <DashboardIcon name="briefcase" />,
                children: [
                  {
                    label: "Correction of Entry",
                  },
                ],
              },
            ]
          : []),
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
