import { useQueryClient } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import type { FacultySession } from "./types";
import { useCountdown } from "./useCountdown";
import { facultySessionKey } from "./useFacultyAuth";

export function FacultyDashboard() {
  const queryClient = useQueryClient();
  const session = queryClient.getQueryData<FacultySession>(facultySessionKey);
  const remaining = useCountdown(session?.expiresAt);
  if (session?.role !== "faculty" || remaining === 0) return <Navigate to="/" replace />;
  return (
    <main className="min-h-dvh bg-stone-50 px-6 py-16 text-stone-900">
      <div className="mx-auto max-w-4xl">
        <p className="text-brand-maroon mb-3 font-semibold">CBPUPSIS · Faculty Portal</p>
        <h1 className="mb-4 text-3xl font-bold">Faculty dashboard</h1>
        <p role="status">You are securely signed in.</p>
        <section
          className="mt-8 rounded-xl border border-stone-300 bg-white p-6"
          aria-labelledby="dashboard-empty"
        >
          <h2 id="dashboard-empty" className="mb-2 text-xl font-semibold">
            Welcome to your Faculty Portal
          </h2>
          <p>Faculty dashboard content is not available yet.</p>
        </section>
      </div>
    </main>
  );
}
