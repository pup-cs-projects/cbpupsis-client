import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { MOCK_SCHEDULE, mockIcsExport } from "./scheduleMocks";
import type { CalendarConnectStart, ExportFile, StudentSchedule } from "./scheduleTypes";

/*
 * The schedule page's data calls. No endpoint exists for any of them yet.
 *
 * As in dashboard/api.ts, each call reads import.meta.env.DEV inline, so a production build
 * folds it to the empty branch and drops scheduleMocks.ts from the bundle. When an endpoint
 * lands, its call goes in packages/shared (CONVENTIONS: data flow), parsed at the boundary, and
 * the function here calls it through the portal's session; then delete its mock.
 *
 * The two exports return files, not JSON: they need a blob-reading request beside
 * ApiClient.request in packages/shared/api.
 */
export const scheduleApi = {
  // TODO(api): GET /schedule: the signed-in student's current-term courses and summary.
  async schedule(): Promise<StudentSchedule | null> {
    return import.meta.env.DEV ? MOCK_SCHEDULE : null;
  },

  // TODO(api): GET /export/pdf: the Certificate of Registration for the current term, as
  // application/pdf, with its filename in Content-Disposition. Null until then.
  async exportPdf(): Promise<ExportFile | null> {
    return null;
  },

  // TODO(api): GET /export/ics: the term's classes as weekly recurring events (text/calendar).
  // Dev builds one locally from the mock schedule so the button can be tried end to end.
  async exportIcs(): Promise<ExportFile | null> {
    return import.meta.env.DEV ? mockIcsExport(MOCK_SCHEDULE) : null;
  },

  // TODO(api): POST /calendar/google/connect: returns Google's OAuth consent URL. The API keeps
  // the state parameter and handles the callback, then redirects back to /schedule with
  // ?calendar=connected (or =denied), which this page should read and announce.
  async connectGoogleCalendar(): Promise<CalendarConnectStart | null> {
    return null;
  },
};

export const scheduleKeys = {
  all: ["schedule"] as const,
  current: () => [...scheduleKeys.all, "current"] as const,
};

// Each call goes through scheduleApi's property at call time, so a test can stand in for it.

export function useCourseSchedule() {
  return useQuery({ queryKey: scheduleKeys.current(), queryFn: () => scheduleApi.schedule() });
}

/** Hand a downloaded file to the browser's save flow. */
function saveFile({ blob, filename }: ExportFile) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Let the click start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export type ScheduleAction = "pdf" | "ics" | "google";

export interface ActionNotice {
  tone: "info" | "success";
  text: string;
}

const UNAVAILABLE: Record<ScheduleAction, string> = {
  pdf: "Downloading your COR isn't available yet. Please check back soon.",
  ics: "Calendar export isn't available yet. Please check back soon.",
  google: "Google Calendar sync isn't available yet. Please check back soon.",
};

/** The right rail's three buttons: COR download, .ics export, and Google Calendar connect. */
export function useScheduleActions() {
  const [notice, setNotice] = useState<ActionNotice | null>(null);

  const pdf = useMutation({
    mutationFn: () => scheduleApi.exportPdf(),
    onSuccess: (file) => {
      if (!file) return setNotice({ tone: "info", text: UNAVAILABLE.pdf });
      saveFile(file);
      setNotice({ tone: "success", text: "Your Certificate of Registration is downloading." });
    },
  });

  const ics = useMutation({
    mutationFn: () => scheduleApi.exportIcs(),
    onSuccess: (file) => {
      if (!file) return setNotice({ tone: "info", text: UNAVAILABLE.ics });
      saveFile(file);
      setNotice({
        tone: "success",
        text: "Your schedule (.ics) is downloading. Open it to add your classes to a calendar.",
      });
    },
  });

  const google = useMutation({
    mutationFn: () => scheduleApi.connectGoogleCalendar(),
    onSuccess: (start) => {
      if (!start) return setNotice({ tone: "info", text: UNAVAILABLE.google });
      window.location.assign(start.authorizationUrl);
    },
  });

  const mutations = { pdf, ics, google };
  const pending = (Object.keys(mutations) as ScheduleAction[]).find(
    (key) => mutations[key].isPending,
  );
  const failed = [pdf, ics, google].find((mutation) => mutation.isError);

  function run(action: ScheduleAction) {
    // One outcome at a time: a new press clears the last one's notice or error.
    setNotice(null);
    for (const mutation of Object.values(mutations)) mutation.reset();
    mutations[action].mutate();
  }

  return {
    downloadCor: () => run("pdf"),
    exportIcs: () => run("ics"),
    connectGoogleCalendar: () => run("google"),
    pending: pending ?? null,
    notice,
    error: failed?.error ?? null,
    retry: failed ? () => failed.mutate() : undefined,
  };
}
