import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { StudentSchedule as ApiSchedule } from "@cbpupsis/shared/schedule";

import { scheduleApi as api, session } from "../../lib/auth";
import {
  WEEKDAYS,
  type CalendarConnectStart,
  type CourseItem,
  type ExportFile,
  type StudentSchedule,
} from "./scheduleTypes";

const SEMESTERS: Record<string, string> = {
  first: "First Semester",
  second: "Second Semester",
  summer: "Summer Term",
};

/** The API's schedule in the page's shape; null (the empty state) without a term or classes. */
export function toPageSchedule(schedule: ApiSchedule): StudentSchedule | null {
  if (!schedule.term || schedule.courses.length === 0) return null;
  const courses: CourseItem[] = schedule.courses.map((course) => ({
    id: course.sectionId,
    courseCode: course.code,
    courseTitle: course.title,
    units: course.units,
    schedule: course.meetings.map((meeting) => ({
      day: WEEKDAYS[meeting.dayOfWeek] ?? "Mon",
      timeStart: meeting.startTime,
      timeEnd: meeting.endTime,
    })),
    faculty: course.facultyName ?? "To be announced",
    location: course.room ?? course.meetings.find((m) => m.room)?.room ?? "To be announced",
  }));
  return {
    summary: {
      totalUnits: schedule.totalCredits,
      totalCourses: courses.length,
      academicYear: schedule.term.year.replace("-", "–"),
      semester: SEMESTERS[schedule.term.semester] ?? schedule.term.semester,
    },
    courses,
  };
}

/** The schedule page's data calls, through the portal's session. */
export const scheduleApi = {
  async schedule(): Promise<StudentSchedule | null> {
    return toPageSchedule(await session.authorized((token) => api.current(token)));
  },

  /** The Certificate of Registration for the current term, as a PDF. */
  async exportPdf(): Promise<ExportFile | null> {
    return session.authorized((token) => api.export(token, "pdf"));
  },

  /** The term's classes as weekly recurring events (text/calendar). */
  async exportIcs(): Promise<ExportFile | null> {
    return session.authorized((token) => api.export(token, "ics"));
  },

  // TODO(api): Google sync is served (/students/me/schedule/google-calendar) but off unless
  // GOOGLE_CALENDAR_ENABLED, and needs this portal to post Google's callback code back. Until
  // that flow is built, the button says it is not available yet.
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
    // Superseded by the printable /enrollment/certificate view (issue #43); kept for the
    // server-rendered PDF export, which nothing currently calls.
    downloadCor: () => run("pdf"),
    exportIcs: () => run("ics"),
    connectGoogleCalendar: () => run("google"),
    pending: pending ?? null,
    notice,
    error: failed?.error ?? null,
    retry: failed ? () => failed.mutate() : undefined,
  };
}
