export const gradeButton =
  "focus-visible:outline-offset-0! inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-brand-border/40 bg-white px-4 py-2 text-sm font-semibold hover:bg-brand-paper disabled:cursor-not-allowed disabled:opacity-50";
export const gradePrimary =
  gradeButton + " border-brand-maroon! bg-brand-maroon! text-white hover:bg-brand-maroon-dark!";
export const gradeField =
  "border-brand-input-border focus-visible:outline-offset-0! min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm disabled:bg-neutral-100";
export const gradeCard =
  "border-brand-border/25 min-w-0 rounded-2xl border bg-white p-5 shadow-sm sm:p-6";
export function gradeDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(new Date(value))
    : "Not provided";
}
