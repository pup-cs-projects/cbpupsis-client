import { useId, useState } from "react";

import { refusalMessage } from "./enrollmentDisplay";
import { useRequestOverload } from "./useEnrollment";

interface OverloadPanelProps {
  eligible: boolean;
  /** The API's term selector the request is filed for. */
  term: string;
}

const card = "border-brand-border/25 rounded-2xl border bg-white p-5 shadow-sm";

/**
 * Lets an eligible student ask for up to 9 extra units. A Dean decides it elsewhere, so once
 * filed there is nothing more to do here but wait (AC-ENRL-001.3, .4, .5).
 */
export function OverloadPanel({ eligible, term }: OverloadPanelProps) {
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState(3);
  const [justification, setJustification] = useState("");
  const mutation = useRequestOverload(term);
  const unitsId = useId();
  const justificationId = useId();

  if (!eligible) return null;

  if (mutation.isSuccess) {
    return (
      <section aria-labelledby="overload-heading" className={card}>
        <h2 id="overload-heading" className="text-brand-ink text-base font-bold">
          Overload
        </h2>
        <p role="status" className="mt-3">
          <span className="bg-brand-gold/40 text-brand-ink inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
            Waiting for the Dean
          </span>
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="overload-heading" className={card}>
      <h2 id="overload-heading" className="text-brand-ink text-base font-bold">
        Overload
      </h2>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-brand-crimson hover:bg-brand-crimson-dark mt-3 min-h-11 rounded-xl px-5 text-sm font-semibold text-white"
        >
          Request an overload
        </button>
      ) : (
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate({ requestedUnits: units, justification });
          }}
        >
          <div>
            <label htmlFor={unitsId} className="text-brand-ink block text-sm font-semibold">
              Extra units (up to 9) <span className="text-brand-crimson">*</span>
            </label>
            <input
              id={unitsId}
              type="number"
              min={1}
              max={9}
              required
              value={units}
              onChange={(event) => setUnits(Number(event.target.value))}
              className="border-brand-input-border mt-1 min-h-11 w-24 rounded-lg border px-3"
            />
          </div>
          <div>
            <label htmlFor={justificationId} className="text-brand-ink block text-sm font-semibold">
              Why do you need it? <span className="text-brand-crimson">*</span>
            </label>
            <textarea
              id={justificationId}
              required
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              className="border-brand-input-border mt-1 w-full rounded-lg border px-3 py-2"
              rows={3}
            />
          </div>

          {mutation.isError && (
            <div
              role="alert"
              className="rounded-xl border border-red-700/30 bg-red-50 p-3 text-sm text-red-900"
            >
              <p className="font-bold">Could not file your overload request.</p>
              <p className="mt-1">{refusalMessage(mutation.error)}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-brand-crimson hover:bg-brand-crimson-dark min-h-11 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {mutation.isPending ? "Sending…" : "Submit request"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-brand-ink min-h-11 rounded-xl px-5 text-sm font-semibold hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
