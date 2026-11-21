import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { StudentSchedule as ApiSchedule } from "@cbpupsis/shared/schedule";

import { scheduleApi as api, session } from "../../lib/auth";
import { WEEKDAYS, type CourseItem, type ExportFile, type StudentSchedule } from "./scheduleTypes";

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
    term: { ...schedule.term },
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

export type ScheduleAction = "pdf" | "ics";

export interface ActionNotice {
  tone: "info" | "success";
  text: string;
}

const UNAVAILABLE: Record<ScheduleAction, string> = {
  pdf: "Downloading your COR isn't available yet. Please check back soon.",
  ics: "Calendar export isn't available yet. Please check back soon.",
};

/** Schedule downloads stay independent of the optional Google Calendar integration. */
export function useScheduleActions() {
  const [notice, setNotice] = useState<ActionNotice | null>(null);

  const pdf = useMutation({
    mutationFn: () => scheduleApi.exportPdf(),
    onSuccess: (file) => {
      if (!file) return setNotice({ tone: "info", text: UNAVAILABLE.pdf });
      saveFile(file);
      setNotice({ tone: "success", text: "Your schedule is downloading." });
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

  const mutations = { pdf, ics };
  const pending = (Object.keys(mutations) as ScheduleAction[]).find(
    (key) => mutations[key].isPending,
  );
  const failed = [pdf, ics].find((mutation) => mutation.isError);

  function run(action: ScheduleAction) {
    // One outcome at a time: a new press clears the last one's notice or error.
    setNotice(null);
    for (const mutation of Object.values(mutations)) mutation.reset();
    mutations[action].mutate();
  }

  return {
    downloadCor: () => run("pdf"),
    exportIcs: () => run("ics"),
    pending: pending ?? null,
    notice,
    error: failed?.error ?? null,
    retry: failed ? () => failed.mutate() : undefined,
  };
}
