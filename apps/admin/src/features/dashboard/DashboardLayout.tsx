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
import { reportTabsFor } from "../reports/access";
import { canManageFees } from "../fee-structures/access";
import { useProfile } from "./queries";

/** Portal navigation and account wiring, separate from the dashboard page like student. */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const me = useMe();
  const profile = useProfile(me.isSuccess);
  const name = profile.data?.full_name?.trim() || profile.data?.display_name?.trim() || "Admin";
  const settingsLink =
    "focus-visible:outline-brand-gold! flex min-h-11 items-center py-2.5 pr-4 pl-12 text-sm text-white/85 hover:bg-white/10";

  return (
    <PortalDashboardLayout
      portal="Admin"
      homeLink={(className, children) => (
        <Link to="/dashboard" className={className}>
          {children}
        </Link>
      )}
      navigation={[
        // The shared layout already renders the "Dashboard" link above these sections, as the
        // student and faculty sidebars do; a separate Home section would duplicate it.
        {
          label: "Users",
          icon: <DashboardIcon name="users" />,
          children: [{ label: "User Management" }],
        },
        {
          label: "Academics",
          icon: <DashboardIcon name="mail" />,
          children: [
            { label: "Calendar" },
            { label: "Courses" },
            ...(me.data?.position === "dean"
              ? [
                  {
                    label: "Inc completions",
                    content: (
                      <Link to="/incomplete-completions" className={settingsLink}>
                        Inc completions
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
        {
          label: "Reports",
          icon: <DashboardIcon name="briefcase" />,
          children: [
            { label: "User Management" },
            reportTabsFor(me.data?.position).length > 0
              ? {
                  label: "Enrollment",
                  content: (
                    <Link to="/reports" className={settingsLink}>
                      Enrollment
                    </Link>
                  ),
                }
              : { label: "Enrollment" },
            { label: "Financial" },
            { label: "System Health" },
          ],
        },
        ...(["chairperson", "dean", "registrar"].includes(me.data?.position ?? "")
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
        // Finance alone holds ManageFeeStructure; Registrar, Dean, and Chair never see the link.
        ...(canManageFees(me.data?.position)
          ? [
              {
                label: "Financial",
                icon: <DashboardIcon name="briefcase" />,
                children: [
                  {
                    label: "Fee structure",
                    content: (
                      <Link to="/fee-structures" className={settingsLink}>
                        Fee structure
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
