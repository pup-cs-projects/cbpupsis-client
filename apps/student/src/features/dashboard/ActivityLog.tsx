import { formatTimestamp, isWithinLastDays } from "../../lib/datetime";
import { Modal } from "./Modal";
import type { ActivityItem, ActivityStatus } from "./types";
import { ACTIVITY_WINDOW_DAYS, newestFirst } from "./view";

// The bar's color is never alone: each item also carries its status in words. Only a warning
// (a failed sign-in, say) shows its word on screen; the others are routine.
const STATUS: Record<ActivityStatus, { word: string; bar: string; visible: boolean }> = {
  success: { word: "Completed", bar: "bg-brand-success", visible: false },
  info: { word: "Update", bar: "bg-brand-gold", visible: false },
  warning: { word: "Needs attention", bar: "bg-brand-maroon", visible: true },
};

export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const status = STATUS[item.status];
        return (
          <li key={item.id} className="flex gap-3">
            <div className="mt-1 shrink-0" aria-hidden="true">
              <div className={`h-8 w-1 rounded-full ${status.bar}`} />
            </div>
            <div className="min-w-0">
              <p className="text-brand-muted text-xs font-medium break-words">
                <span className={status.visible ? "" : "sr-only"}>{status.word}: </span>
                <time dateTime={item.occurredAt}>{formatTimestamp(item.occurredAt)}</time>
              </p>
              <p className="text-brand-ink mt-0.5 text-[13px] break-words">{item.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface ActivityModalProps {
  items: ActivityItem[];
  onClose: () => void;
}

/** The activity log for the past 90 days, newest first. */
export function ActivityModal({ items, onClose }: ActivityModalProps) {
  const recent = newestFirst(items).filter((item) =>
    isWithinLastDays(item.occurredAt, ACTIVITY_WINDOW_DAYS),
  );

  return (
    <Modal title="All activity" onClose={onClose}>
      <p className="text-brand-muted mb-3 text-xs">
        Showing activity from the past {ACTIVITY_WINDOW_DAYS} days
      </p>
      {recent.length === 0 ? (
        <p className="text-brand-muted text-sm">
          No activity in the past {ACTIVITY_WINDOW_DAYS} days.
        </p>
      ) : (
        <ActivityList items={recent} />
      )}
    </Modal>
  );
}
