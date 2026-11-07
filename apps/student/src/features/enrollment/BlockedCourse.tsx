import type { BlockedSection } from "@cbpupsis/shared/enrollment";

import { unlockText } from "./blocking";
import { WaiverForm } from "./WaiverForm";
import { WaiverStatus } from "./WaiverStatus";

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="text-brand-maroon mt-0.5 h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/**
 * Why a section is blocked and what unlocks it (AC-ENRL-002.1 to .6), plus the waiver request
 * and its steps where a waiver is possible (AC-ENRL-002.9). Renders nothing for an open section.
 */
export function BlockedCourse({
  section,
  onWaiverFiled,
}: {
  section: BlockedSection;
  /** Called after a waiver is filed, so the page can refetch available courses. */
  onWaiverFiled?: () => void;
}) {
  const blocks = section.blocks ?? [];
  const blocked = section.prerequisitesSatisfied === false || blocks.length > 0;
  if (!blocked) return null;

  const unlocks = blocks
    .map((block) => unlockText(block))
    .filter((line): line is string => line !== null);
  const hasPrerequisite = blocks.some(
    (block) =>
      block.rule === "ENROLL_PREREQUISITE_NOT_MET" || block.rule === "ENROLL_WAIVER_PENDING",
  );

  return (
    <div className="border-brand-border/25 bg-brand-cream/40 space-y-3 rounded-xl border p-3 text-sm break-words">
      <p className="text-brand-ink flex items-start gap-2">
        <LockIcon />
        <span>
          <span className="sr-only">Blocked: </span>
          {section.blockReason ?? `${section.courseCode} is blocked.`}
        </span>
      </p>
      {unlocks.length > 0 && (
        <div>
          <p className="font-semibold">What unlocks it</p>
          <ul className="list-disc space-y-1 pl-5">
            {unlocks.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      <WaiverForm section={section} onFiled={onWaiverFiled} />
      {(section.waiverAvailable || hasPrerequisite) && (
        <WaiverStatus sectionId={section.sectionId} />
      )}
    </div>
  );
}
