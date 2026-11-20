import { SignOutButton } from "@cbpupsis/account";
import {
  DashboardHeader,
  DashboardIcon,
  DashboardProfileCard,
  DashboardLayout as PortalDashboardLayout,
} from "@cbpupsis/ui";
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useMe } from "../sign-in/useAdminAuth";
import { isReviewerRole } from "../enrollment-requests/reviewRules";
import { useCatalogAccess } from "../catalog/useCatalogAccess";
import { useReportAccess } from "../reports/reportAccess";
import { useProfile } from "./queries";

/** Portal navigation and account wiring, separate from the dashboard page like student. */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const me = useMe();
  const pathname = useLocation({ select: (location) => location.pathname });
  const activeSection = pathname.startsWith("/users")
    ? "Users"
    : pathname.startsWith("/catalog") ||
        pathname.startsWith("/enrollment-requests") ||
        pathname.startsWith("/incomplete-completions")
      ? "Academics"
      : pathname.startsWith("/grade-corrections")
        ? "Grade corrections"
        : pathname.startsWith("/reports")
          ? "Reports"
          : pathname.startsWith("/profile")
            ? "Settings"
            : undefined;
  const rawCatalogAccess = useCatalogAccess();
  const catalogAccess = {
    readable:
      rawCatalogAccess.readable &&
      Object.keys(import.meta.glob("../catalog/CatalogPage.tsx")).length > 0,
  };
  const hasUsers = Object.keys(import.meta.glob("../users/UserManagementPage.tsx")).length > 0;
  const rawReportAccess = useReportAccess();
  const reportAccess = {
    allowed:
      rawReportAccess.allowed &&
      Object.keys(import.meta.glob("../reports/ReportsPage.tsx")).length > 0,
  };
  const profile = useProfile(me.isSuccess);
  const name = profile.data?.full_name?.trim() || profile.data?.display_name?.trim() || "Admin";
  const settingsLink =
    "admin-sidebar-link focus-visible:outline-brand-gold! flex min-h-11 w-full items-center py-2.5 pr-4 pl-12 text-sm text-white/90 hover:bg-white/10";

  return (
    <PortalDashboardLayout
      portal="Admin"
      activeSection={activeSection}
      headerTools={
        <DashboardHeader
          name={name}
          email={profile.data?.email ?? me.data?.email}
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
            <Link to="/notifications" className={className}>
              {children}
            </Link>
          )}
          items={[
            {
              label: "Dashboard",
              content: (
                <Link
                  to="/dashboard"
                  className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-neutral-50"
                >
                  Dashboard
                </Link>
              ),
            },
            ...(isReviewerRole(me.data?.position)
              ? [
                  {
                    label: "User Management",
                    content: (
                      <Link
                        to="/users"
                        className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-neutral-50"
                      >
                        User Management
                      </Link>
                    ),
                  },
                  {
                    label: "Enrollment requests",
                    content: (
                      <Link
                        to="/enrollment-requests"
                        className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-neutral-50"
                      >
                        Enrollment requests
                      </Link>
                    ),
                  },
                  {
                    label: "Correction of Entry",
                    content: (
                      <Link
                        to="/grade-corrections"
                        className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-neutral-50"
                      >
                        Correction of Entry
                      </Link>
                    ),
                  },
                ]
              : []),
            ...(catalogAccess.readable
              ? [
                  {
                    label: "Course Management",
                    content: (
                      <Link
                        to="/catalog"
                        className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-neutral-50"
                      >
                        Course Management
                      </Link>
                    ),
                  },
                ]
              : []),
            ...(reportAccess.allowed
              ? [
                  {
                    label: "Enrollment reports",
                    content: (
                      <Link
                        to="/reports"
                        className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-neutral-50"
                      >
                        Enrollment reports
                      </Link>
                    ),
                  },
                ]
              : []),
          ].filter((item) => item.label !== "User Management" || hasUsers)}
          signOut={
            <SignOutButton className="flex min-h-11 w-full cursor-pointer items-center px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">
              Logout
            </SignOutButton>
          }
        />
      }
      homeLink={(className, children) => (
        <Link to="/dashboard" className={className}>
          {children}
        </Link>
      )}
      navigation={[
        ...(hasUsers && isReviewerRole(me.data?.position)
          ? [
              {
                label: "Users",
                icon: <DashboardIcon name="users" />,
                children: [
                  {
                    label: "User Management",
                    content: (
                      <Link to="/users" className={settingsLink}>
                        User Management
                      </Link>
                    ),
                  },
                ],
              },
            ]
          : []),
        ...(catalogAccess.readable || isReviewerRole(me.data?.position)
          ? [
              {
                label: "Academics",
                icon: <DashboardIcon name="academics" />,
                children: [
                  { label: "Calendar" },
                  ...(catalogAccess.readable
                    ? [
                        {
                          label: "Course Management",
                          content: (
                            <Link to="/catalog" className={settingsLink}>
                              Course Management
                            </Link>
                          ),
                        },
                      ]
                    : []),
                  ...(me.data?.position === "dean"
                    ? [
                        {
                          label: "INC completions",
                          content: (
                            <Link to="/incomplete-completions" className={settingsLink}>
                              INC completions
                            </Link>
                          ),
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
                    content: (
                      <Link to="/reports" className={settingsLink}>
                        Enrollment
                      </Link>
                    ),
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
                    content: (
                      <Link to="/grade-corrections" className={settingsLink}>
                        Correction of Entry
                      </Link>
                    ),
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
              label: "Profile",
              content: (
                <Link to="/profile" className={settingsLink}>
                  Profile
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
