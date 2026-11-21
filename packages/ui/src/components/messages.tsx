import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { formatTime } from "../hooks/useCountdown";
import "../styles/messages.css";

type Tone = "error" | "info" | "success";

/** How long an info or success toast stays, unless hovered or focused. Errors never go alone. */
export const TOAST_DISMISS_MS = 8000;

const REGION_ID = "cbpupsis-toasts";

/**
 * The one region every toast renders into, at the end of the page. A portal, because a fixed
 * element inside the sign-in card would be trapped by the card's backdrop-filter; and last in
 * the document, so keyboard users reach a toast after the page's own controls.
 */
function toastRegion(): HTMLElement {
  const existing = document.getElementById(REGION_ID);
  if (existing) return existing;
  const region = document.createElement("div");
  region.id = REGION_ID;
  region.className = "toast-region";
  document.body.append(region);
  return region;
}

/** Each tone has its own symbol in the circle, so the tone never rests on color alone. */
function ToneIcon({ tone }: { tone: Tone }) {
  return (
    <svg
      className="toast-icon"
      viewBox="0 0 36 36"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="18" cy="18" r="16" />
      {tone === "error" && <path d="M12.5 12.5l11 11M23.5 12.5l-11 11" />}
      {tone === "info" && (
        <>
          <path d="M18 16.5v9" />
          <circle cx="18" cy="11.5" r="0.6" fill="currentColor" strokeWidth="2.6" />
        </>
      )}
      {tone === "success" && <path d="M11.5 18.5l4.5 4.5 8.5-9.5" />}
    </svg>
  );
}

/**
 * Show a toast until it is dismissed, and again when `subject` changes: a new error object, or
 * a new notice. So a second failed sign-in shows again even when the API says the same thing.
 */
function useDismissal(subject: unknown) {
  const [state, setState] = useState({ subject, generation: 0, dismissed: false });
  if (state.subject !== subject) {
    // Adjusting state to a changed prop during render: React's own pattern, no effect needed.
    setState({ subject, generation: state.generation + 1, dismissed: false });
  }
  const dismiss = useCallback(() => setState((current) => ({ ...current, dismissed: true })), []);
  return { dismissed: state.dismissed, generation: state.generation, dismiss };
}

interface ToastProps {
  tone: Tone;
  title: string;
  subject: unknown;
  /** Where screen readers hear it: the whole toast for an error, the sentence for a notice. */
  live: "alert" | "status";
  placement: "toast" | "inline";
  message: ReactNode;
  children?: ReactNode;
}

function Toast({ subject, placement, ...props }: ToastProps) {
  const { dismissed, generation, dismiss } = useDismissal(subject);
  const [region] = useState(() => (placement === "toast" ? toastRegion() : null));
  if (dismissed) return null;
  // Keyed by generation, so a new subject starts a fresh card with a fresh timer.
  const card = <ToastCard key={generation} {...props} placement={placement} onDismiss={dismiss} />;
  return region ? createPortal(card, region) : card;
}

function ToastCard({
  tone,
  title,
  live,
  placement,
  message,
  children,
  onDismiss,
}: Omit<ToastProps, "subject"> & { onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(TOAST_DISMISS_MS);
  const expires = tone !== "error";

  // Info and success leave after a while, but never while the person is reading or using them.
  useEffect(() => {
    if (!expires || paused) return;
    const started = Date.now();
    const timer = window.setTimeout(onDismiss, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [expires, paused, onDismiss]);

  function blur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
  }

  return (
    <div
      className={`toast toast--${tone}${placement === "inline" ? "toast--inline" : ""}`}
      role={live === "alert" ? "alert" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={blur}
    >
      <ToneIcon tone={tone} />
      <div className="toast-body">
        <p className="toast-title">{title}</p>
        <p className="toast-message" role={live === "status" ? "status" : undefined}>
          {/* An error's title already says what it is; a notice's title sits outside its live
              sentence, so the sentence carries the one spoken prefix. */}
          {live === "status" && <span className="sr-only">Notice: </span>}
          {message}
        </p>
        {children}
      </div>
      <button type="button" className="toast-close" aria-label="Dismiss" onClick={onDismiss}>
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * A failed request, as a toast: a generic title, then the API's own words, then anything the
 * person can do about it (a countdown, a link), an optional Try again, and the reference for a
 * bug report. It never leaves on its own (WCAG 2.2.1); Dismiss hides it until the next error.
 */
export function ErrorAlert({
  error,
  title = "Something went wrong",
  onRetry,
  placement = "toast",
  children,
}: {
  error: unknown;
  title?: string;
  /** Offer "Try again", for a load the person can repeat. */
  onRetry?: () => void;
  /**
   * `inline` keeps the toast in the page's flow. Only for a modal dialog: a toast outside an
   * aria-modal dialog is hidden from screen readers and out of reach of its focus trap.
   */
  placement?: "toast" | "inline";
  children?: ReactNode;
}) {
  return (
    <Toast
      tone="error"
      title={title}
      subject={error}
      live="alert"
      placement={placement}
      message={errorMessage(error)}
    >
      {/* Children.toArray drops the false and null of conditional children. */}
      {Children.toArray(children).length > 0 && <div className="toast-extra">{children}</div>}
      {onRetry && (
        <button type="button" className="toast-action" onClick={onRetry}>
          Try again
        </button>
      )}
      {error instanceof ApiError && error.requestId && <Reference id={error.requestId} />}
    </Toast>
  );
}

/**
 * What just happened, as a toast: an outcome after a redirect (`info`) or a step that worked
 * (`success`). It leaves after 8 seconds, waiting while hovered or focused.
 */
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success";
  title?: string;
  children: ReactNode;
}) {
  return (
    <Toast
      tone={tone}
      title={title ?? (tone === "success" ? "Done" : "Notice")}
      subject={textOf(children)}
      live="status"
      placement="toast"
      message={children}
    />
  );
}

/**
 * A notice's identity is its text: children such as `Opening the {portalName}.` are a new array
 * on every render, which must not count as a new notice.
 */
function textOf(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
    .join("");
}

type CopyState = "idle" | "copied" | "unavailable";

/** The request id, with a Copy button so a bug report can carry it without retyping. */
function Reference({ id }: { id: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const idText = useRef<HTMLElement>(null);

  // "Copied" reads as done for a moment, then the button is ready again.
  useEffect(() => {
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setState("copied");
    } catch {
      // No clipboard (an insecure context or an old browser): select it for a manual copy.
      const node = idText.current;
      const selection = window.getSelection();
      if (node && selection) selection.selectAllChildren(node);
      setState("unavailable");
    }
  }

  return (
    <p className="toast-ref">
      <span className="toast-ref-label" aria-hidden="true">
        Ref
      </span>
      <span className="sr-only">Reference </span>
      <code ref={idText} className="toast-ref-id">
        {id}
      </code>
      <button type="button" className="toast-copy" aria-label="Copy reference" onClick={copy}>
        {state === "copied" ? "Copied" : "Copy"}
      </button>
      <span className="sr-only" role="status">
        {state === "copied"
          ? "Copied"
          : state === "unavailable"
            ? "Copy is not available here. The reference is selected so you can copy it."
            : ""}
      </span>
    </p>
  );
}

/**
 * The wait before a locked or rate-limited request may be tried again, under the API's own
 * sentence. Nothing shows when the API gave no wait.
 */
export function RetryCountdown({ remaining }: { remaining: number | undefined }) {
  if (remaining === undefined) return null;
  return remaining > 0 ? (
    <p>
      Try again in{" "}
      <span role="timer" aria-label="Time before you can try again">
        {formatTime(remaining)}
      </span>
    </p>
  ) : (
    <p>You can try again now.</p>
  );
}
