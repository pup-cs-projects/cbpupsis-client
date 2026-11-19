import { ApiError } from "@cbpupsis/shared/api";
import type { GoogleCalendarConnection, ScheduleTerm } from "@cbpupsis/shared/schedule";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { session } from "../../lib/auth";
import { authKeys, useMe } from "../sign-in/queries";
import {
  calendarNavigation,
  GOOGLE_CALENDAR_MESSAGES,
  googleCalendarApi,
  googleCalendarError,
  googleCalendarKeys,
  termKey,
} from "./googleCalendar";

interface Feedback {
  tone: "success" | "error";
  message: string;
}
class SyncFailure extends Error {
  readonly failure: unknown;
  readonly queued: number;
  constructor(failure: unknown, queued: number) {
    super("Calendar synchronization was interrupted");
    this.failure = failure;
    this.queued = queued;
  }
}

export function useGoogleCalendar() {
  const me = useMe();
  const ownerId = me.data?.id;
  const client = useQueryClient();
  const running = useRef(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const key = googleCalendarKeys.status(ownerId ?? "signed-out");
  const status = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => googleCalendarApi.status(signal),
    enabled: Boolean(ownerId && session.isSignedIn()),
    retry: false,
    // Refresh is explicit: background polling must not keep an idle SIS session alive.
    refetchOnWindowFocus: false,
  });
  // A local frontend opt-in permits an attempt; the API still decides availability.
  const canConnect =
    status.isSuccess &&
    Boolean(
      status.data &&
      (status.data.enabled ||
        import.meta.env.VITE_GOOGLE_CALENDAR_ALLOW_CONNECT_ATTEMPT === "true") &&
      !status.data.connected,
    );
  function assertOwner(id: string | undefined) {
    if (
      !id ||
      !session.isSignedIn() ||
      client.getQueryData<{ id: string }>(authKeys.me())?.id !== id
    )
      throw new ApiError(401, "NOT_SIGNED_IN");
  }
  function accept(connection: GoogleCalendarConnection, id: string | undefined) {
    assertOwner(id);
    client.setQueryData(googleCalendarKeys.status(id!), connection);
  }
  const authorize = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async (term: ScheduleTerm | undefined) => {
      const id = ownerId;
      assertOwner(id);
      const result = await googleCalendarApi.authorize(term);
      assertOwner(id);
      // Return void so the private authorization URL never enters the mutation cache.
      calendarNavigation.authorize(result.authorizationUrl);
    },
  });
  const synchronize = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async (terms: ScheduleTerm[]) => {
      const id = ownerId;
      let queued = 0;
      for (const term of terms) {
        try {
          assertOwner(id);
          const connection = await googleCalendarApi.sync(term);
          accept(connection, id);
          queued++;
        } catch (error) {
          throw new SyncFailure(error, queued);
        }
      }
      return queued;
    },
    onSuccess: (count) =>
      setFeedback({
        tone: "success",
        message: count === 1 ? "Sync queued" : `Sync queued for ${count} terms`,
      }),
  });
  const removal = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      const id = ownerId;
      assertOwner(id);
      const connection = await googleCalendarApi.disconnect();
      accept(connection, id);
    },
    onSuccess: () =>
      setFeedback({ tone: "success", message: GOOGLE_CALENDAR_MESSAGES.disconnected }),
  });
  async function perform(task: () => Promise<unknown>) {
    if (running.current) return false;
    running.current = true;
    setFeedback(null);
    try {
      await task();
      return true;
    } catch (error) {
      const cause = error instanceof SyncFailure ? error.failure : error;
      const partial =
        error instanceof SyncFailure && error.queued
          ? `Sync queued for ${error.queued} ${error.queued === 1 ? "term" : "terms"}. `
          : "";
      setFeedback({ tone: "error", message: partial + googleCalendarError(cause) });
      // A conflict or an uncertain request needs fresh authoritative status, never a replay.
      void client.invalidateQueries({ queryKey: key });
      return false;
    } finally {
      running.current = false;
    }
  }
  async function sync(terms: ScheduleTerm[]) {
    const pinned = status.data?.targets ?? [];
    const unique = new Map(terms.map((term) => [termKey(term), term]));
    if (
      !unique.size ||
      unique.size > 10 ||
      new Set([...pinned, ...unique.values()].map(termKey)).size > 10
    ) {
      setFeedback({
        tone: "error",
        message: "Choose between one and ten terms. Already linked terms count toward the limit.",
      });
      return { success: false, queuedTerms: [] as string[] };
    }
    if (
      !status.isSuccess ||
      !status.data?.enabled ||
      !status.data.connected ||
      status.data.disconnecting
    )
      return { success: false, queuedTerms: [] as string[] };
    const batch = [...unique.values()];
    let queued = 0;
    const success = await perform(async () => {
      try {
        queued = await synchronize.mutateAsync(batch);
      } catch (error) {
        if (error instanceof SyncFailure) queued = error.queued;
        throw error;
      }
    });
    return { success, queuedTerms: batch.slice(0, queued).map(termKey) };
  }
  return {
    status,
    feedback,
    busy: authorize.isPending || synchronize.isPending || removal.isPending,
    canConnect,
    connecting: authorize.isPending,
    syncing: synchronize.isPending,
    removing: removal.isPending,
    connect: (term?: ScheduleTerm) => {
      if (!canConnect) return;
      void perform(async () => {
        // The API refuses new consent while the previous revocation is pending, and status is
        // never polled: look again first, and only start consent once the removal has finished.
        if (status.data?.disconnecting) {
          const fresh = await status.refetch();
          if (fresh.isError) return;
          if (fresh.data?.disconnecting) {
            setFeedback({ tone: "error", message: GOOGLE_CALENDAR_MESSAGES.stillDisconnecting });
            return;
          }
        }
        await authorize.mutateAsync(term);
      });
    },
    sync,
    clearFeedback: () => setFeedback(null),
    disconnect: () => perform(() => removal.mutateAsync()),
    refresh: () => {
      if (!running.current) void status.refetch();
    },
  };
}

export type GoogleCalendarController = ReturnType<typeof useGoogleCalendar>;
