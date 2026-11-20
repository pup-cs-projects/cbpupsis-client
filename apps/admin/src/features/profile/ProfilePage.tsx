import { errorMessage } from "@cbpupsis/shared/api";
import { Link } from "@tanstack/react-router";
import { AdminPage, adminButton, adminCard } from "../../components/AdminPage";
import { useProfile } from "../dashboard/queries";
import { useMe } from "../sign-in/useAdminAuth";

/** Own account only; Student and Faculty Management remain separate administrative pages. */
export function ProfilePage() {
  const me = useMe();
  const profile = useProfile(me.isSuccess);
  const error = me.error ?? profile.error;
  return (
    <AdminPage title="Profile" description="Your administrator account and security settings.">
      <section className={adminCard} aria-labelledby="admin-profile-heading">
        <h2 id="admin-profile-heading" className="text-brand-maroon text-xl font-bold">
          Profile information
        </h2>
        {error ? (
          <div role="alert" className="mt-4">
            <p>{errorMessage(error)}</p>
            <button
              className={adminButton + " mt-4"}
              onClick={() => void (me.isError ? me.refetch() : profile.refetch())}
            >
              Retry profile
            </button>
          </div>
        ) : !profile.data || !me.data ? (
          <p role="status" className="mt-4">
            Loading your profile…
          </p>
        ) : (
          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-brand-muted text-sm">Full name</dt>
              <dd className="mt-2 font-medium">
                {profile.data.full_name || profile.data.display_name || "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted text-sm">Email address</dt>
              <dd className="mt-2 font-medium break-all">{profile.data.email}</dd>
            </div>
            <div>
              <dt className="text-brand-muted text-sm">Role</dt>
              <dd className="mt-2 font-medium capitalize">
                {me.data.position.replaceAll("_", " ")}
              </dd>
            </div>
          </dl>
        )}
      </section>
      <section className={adminCard} aria-labelledby="admin-security-heading">
        <h2 id="admin-security-heading" className="text-brand-maroon text-xl font-bold">
          Security
        </h2>
        <p className="text-brand-muted mt-3">
          Update your password using your account’s password rules.
        </p>
        <Link to="/change-password" className={adminButton + " mt-5"}>
          Change Password
        </Link>
      </section>
    </AdminPage>
  );
}
