import { fieldErrors } from "@cbpupsis/shared/api";
import { PROFILE_UPDATE_KEYS } from "@cbpupsis/shared/profile";
import { ErrorAlert, Notice } from "@cbpupsis/ui";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { PsgcAddressPicker } from "./PsgcAddressPicker";
import type { PersonalInfoKey, PersonalInformation } from "./profileTypes";
import { isValidAddress, isValidEmail, isValidPHPhone } from "./profileValidation";

// ---- Icons ----

function SvgIcon({ children, className = "size-4" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={`${className} shrink-0`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const LockIcon = () => (
  <SvgIcon>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </SvgIcon>
);
const EditIcon = () => (
  <SvgIcon>
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </SvgIcon>
);
const SaveIcon = () => (
  <SvgIcon>
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </SvgIcon>
);
const ChevronIcon = ({ open }: { open: boolean }) => (
  <SvgIcon
    className={`size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
      open ? "rotate-180" : ""
    }`}
  >
    <path d="M6 9l6 6 6-6" />
  </SvgIcon>
);
// ---- Sub-components ----

/**
 * An institutional field the student cannot change, shown as plain read-only text (never an
 * input) with a lock. A popover explains why on hover, on click or focus of the lock, and
 * dismisses on mouse-out, click-outside, or Escape.
 */
function LockedField({ id, label, value }: { id: string; label: string; value: string }) {
  const [lockHovered, setLockHovered] = useState(false);
  const [lockActive, setLockActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isOpen = lockHovered || lockActive;
  const popoverId = `${id}-info`;
  const labelId = `${id}-label`;

  useEffect(() => {
    if (!isOpen) return;
    function close() {
      setLockHovered(false);
      setLockActive(false);
    }
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      role="group"
      aria-labelledby={labelId}
      className="relative flex flex-col gap-1.5"
    >
      <span id={labelId} className="text-brand-ink text-sm font-semibold">
        {label}
      </span>

      <div
        className="border-brand-border/40 bg-brand-ink/5 flex min-h-[2.75rem] items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3"
        onMouseEnter={() => setLockHovered(true)}
        onMouseLeave={() => setLockHovered(false)}
      >
        <p className="text-brand-ink min-w-0 text-sm break-words">{value}</p>
        <button
          type="button"
          aria-label={`Why ${label} is locked`}
          aria-describedby={popoverId}
          aria-expanded={isOpen}
          onClick={() => setLockActive((open) => !open)}
          className="text-brand-muted focus-visible:ring-brand-maroon/50 flex shrink-0 items-center gap-1.5 rounded text-xs font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          <LockIcon />
          <span>Locked</span>
        </button>
      </div>

      {/* Popover — always anchored BELOW the field (never flips above) so it never
          collides with the section header or exits the collapsible wrapper upward.
          Mobile: w-full = container width, no horizontal overflow possible.
          sm+: 420px fixed, capped at viewport minus 2 rem of margin. */}
      <div
        id={popoverId}
        role="tooltip"
        className={[
          "absolute top-full left-0 z-50 mt-2",
          "w-full sm:w-[420px] sm:max-w-[calc(100vw-2rem)]",
          "rounded-xl border border-neutral-200 bg-white p-3.5 shadow-xl",
          "origin-top transition duration-150 ease-out",
          isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        ].join(" ")}
      >
        {/* Caret pointing up toward the field */}
        <span className="absolute -top-[5px] left-5 size-[10px] rotate-45 border-t border-l border-neutral-200 bg-white" />
        <p className="text-xs leading-relaxed text-neutral-700 sm:leading-snug lg:text-sm lg:leading-normal">
          Changing your legal name or program requires a formal request through the University
          Registrar&apos;s office with supporting documents.
        </p>
      </div>
    </div>
  );
}

/** Editable field that switches between a read-only display and a live input. */
function ProfileField({
  id,
  label,
  value,
  error,
  isEditing,
  type = "text",
  inputRef,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  isEditing: boolean;
  type?: "text" | "email" | "tel";
  inputRef?: React.Ref<HTMLInputElement>;
  onChange?: (v: string) => void;
}) {
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-brand-ink text-sm font-semibold">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={id}
        type={type}
        value={value}
        readOnly={!isEditing}
        aria-readonly={!isEditing}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange?.(e.target.value)}
        className={[
          "text-brand-ink w-full rounded-xl border px-4 py-3 text-sm transition-colors",
          "focus-visible:ring-brand-maroon focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
          isEditing
            ? "border-brand-border/60 cursor-text bg-white"
            : "border-brand-border/30 cursor-default bg-neutral-50 select-none",
          error ? "border-red-500 focus-visible:ring-red-600" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {/* Reserved line so errors never shift layout */}
      <p
        id={errorId}
        role={error ? "alert" : undefined}
        className="min-h-[1.1rem] text-xs text-red-600"
      >
        {error}
      </p>
    </div>
  );
}

// ---- Types ----

/** An address is `null` while its picker is half-filled. */
type Draft = Record<"phone" | "emailAddress", string> &
  Record<"permanentAddress" | "currentAddress", string | null>;
type FieldErrors = Partial<Record<PersonalInfoKey, string>>;
type Saved = Pick<PersonalInformation, PersonalInfoKey>;

const INCOMPLETE_ADDRESS = "Choose every part of the address, or keep the current one.";

function draftOf(info: PersonalInformation): Draft {
  return {
    phone: info.phone,
    emailAddress: info.emailAddress,
    permanentAddress: info.permanentAddress,
    currentAddress: info.currentAddress,
  };
}

/** One address's problem, if any. An address left as it was saved is never re-judged. */
function addressError(next: string | null, saved: string, empty: string): string | undefined {
  if (next === null) return INCOMPLETE_ADDRESS;
  if (next.trim() === "") return empty;
  if (next !== saved && !isValidAddress(next)) return "Enter a complete address.";
  return undefined;
}

// ---- Main component ----

interface PersonalInfoSectionProps {
  info: PersonalInformation;
  /** Rejects with the API's error, which the form shows; the draft stays open to fix. */
  onSave: (patch: Saved) => Promise<void>;
}

export function PersonalInfoSection({ info, onSave }: PersonalInfoSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(info));
  // While checked, the current address is the permanent one and cannot be edited on its own.
  const [sameAsPermanent, setSameAsPermanent] = useState(false);
  // The separate current address, kept while the box is checked so unchecking brings it back.
  const [ownCurrent, setOwnCurrent] = useState<string | null>(info.currentAddress);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Fresh pickers per edit session, so each starts from the saved address.
  const [session, setSession] = useState(0);
  // Each increment forces Notice to remount so saving twice re-shows the toast.
  const [savedKey, setSavedKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  const sameId = useId();

  // Refs for focus management.
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailAddressRef = useRef<HTMLInputElement>(null);

  const currentAddress = sameAsPermanent ? draft.permanentAddress : draft.currentAddress;

  function clearError(key: PersonalInfoKey) {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function patchDraft(key: PersonalInfoKey, value: string | null) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    clearError(key);
    // The mirrored current address has the same problem as the permanent one it copies.
    if (key === "permanentAddress" && sameAsPermanent) clearError("currentAddress");
  }

  function toggleSame(checked: boolean) {
    setSameAsPermanent(checked);
    clearError("currentAddress");
    if (checked) {
      setOwnCurrent(draft.currentAddress);
    } else {
      setDraft((prev) => ({ ...prev, currentAddress: ownCurrent }));
    }
  }

  function validate(next: Draft): FieldErrors {
    const e: FieldErrors = {};
    if (!isValidPHPhone(next.phone)) {
      e.phone = "Enter a valid Philippine number (e.g. +63 912 345 6789 or 09XX XXX XXXX).";
    }
    if (!isValidEmail(next.emailAddress)) {
      e.emailAddress = "Enter a valid email address.";
    }
    const permanent = addressError(
      next.permanentAddress,
      info.permanentAddress,
      "Choose your permanent address.",
    );
    if (permanent) e.permanentAddress = permanent;
    const current = addressError(
      next.currentAddress,
      info.currentAddress,
      "Choose your current address.",
    );
    if (current) e.currentAddress = current;
    return e;
  }

  function startEdit() {
    const saved = draftOf(info);
    setDraft(saved);
    setSameAsPermanent(
      info.permanentAddress.trim() !== "" && info.currentAddress === info.permanentAddress,
    );
    setOwnCurrent(info.currentAddress);
    setErrors({});
    setSaveError(null);
    setSession((n) => n + 1);
    setIsEditing(true);
  }

  async function handleSave() {
    if (saving) return;
    const next = { ...draft, currentAddress };
    const e = validate(next);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      (e.phone ? phoneRef : e.emailAddress ? emailAddressRef : null)?.current?.focus();
      return;
    }
    // Validation passed, so no address is still half-built.
    const patch: Saved = {
      phone: next.phone,
      emailAddress: next.emailAddress,
      permanentAddress: next.permanentAddress ?? info.permanentAddress,
      currentAddress: next.currentAddress ?? info.currentAddress,
    };
    const isDirty = PROFILE_UPDATE_KEYS.some((key) => patch[key] !== info[key]);
    if (isDirty) {
      setSaving(true);
      setSaveError(null);
      try {
        await onSave(patch);
      } catch (error) {
        // A reason the API tied to one field goes under that field; anything else is a banner.
        const reasons = fieldErrors(error);
        const mine: FieldErrors = {};
        for (const key of PROFILE_UPDATE_KEYS) {
          if (reasons[key]) mine[key] = reasons[key];
        }
        if (Object.keys(mine).length > 0) {
          setErrors(mine);
          (mine.phone ? phoneRef : mine.emailAddress ? emailAddressRef : null)?.current?.focus();
        } else {
          setSaveError(error);
        }
        return;
      } finally {
        setSaving(false);
      }
      setSavedKey((n) => n + 1);
    }
    setIsEditing(false);
    editButtonRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSave();
  }

  const CONTENT_ID = "personal-info-content";

  return (
    <section aria-labelledby="personal-info-heading">
      {/* Success toast — new key forces remount so saving twice replays it. */}
      {savedKey > 0 && (
        <Notice key={savedKey} tone="success">
          Personal information updated successfully.
        </Notice>
      )}
      {saveError !== null && (
        <ErrorAlert error={saveError} title="Personal information was not saved" />
      )}

      {/* Section header */}
      <div className="flex items-center justify-between gap-4">
        <h2 id="personal-info-heading" className="text-brand-ink text-xl font-bold tracking-tight">
          Personal Information
        </h2>

        <div className="flex items-center gap-1">
          {isOpen && !isEditing && (
            <button
              ref={editButtonRef}
              type="button"
              aria-label="Edit personal information"
              className="text-brand-muted hover:text-brand-maroon focus-visible:outline-brand-maroon grid min-h-11 min-w-11 place-items-center rounded-lg transition-colors"
              onClick={startEdit}
            >
              <EditIcon />
            </button>
          )}
          {isOpen && isEditing && (
            <button
              type="submit"
              form="personal-info-form"
              aria-label="Save changes to personal information"
              disabled={saving}
              className="text-brand-muted hover:text-brand-maroon focus-visible:outline-brand-maroon grid min-h-11 min-w-11 place-items-center rounded-lg transition-colors disabled:opacity-60"
            >
              <SaveIcon />
            </button>
          )}
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={CONTENT_ID}
            aria-label={isOpen ? "Collapse personal information" : "Expand personal information"}
            className="text-brand-muted hover:text-brand-maroon focus-visible:outline-brand-maroon grid min-h-11 min-w-11 place-items-center rounded-lg transition-colors"
            onClick={() => setIsOpen((o) => !o)}
          >
            <ChevronIcon open={isOpen} />
          </button>
        </div>
      </div>

      {/* Collapsible content — grid-template-rows trick for smooth CSS animation. */}
      <div
        className="grid transition-all duration-300 ease-in-out motion-reduce:transition-none"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div
          className="min-h-0"
          style={{ overflow: isOpen ? "visible" : "hidden" }}
          id={CONTENT_ID}
        >
          <form
            id="personal-info-form"
            noValidate
            onSubmit={handleSubmit}
            className="border-brand-border/25 mt-4 rounded-2xl border bg-white p-6 shadow-sm"
          >
            {/* Row 1: locked fields — read-only text; the lock explains who can change them */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <LockedField id="fullLegalName" label="Full Legal Name" value={info.fullLegalName} />
              <LockedField id="academicProgram" label="Academic Program" value={info.program} />
            </div>

            {/* Row 2: phone + email */}
            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2">
              <ProfileField
                id="phone"
                label="Phone Number"
                type="tel"
                value={isEditing ? draft.phone : info.phone}
                error={errors.phone}
                isEditing={isEditing}
                inputRef={phoneRef}
                onChange={(v) => patchDraft("phone", v)}
              />
              <ProfileField
                id="emailAddress"
                label="Email Address"
                type="email"
                value={isEditing ? draft.emailAddress : info.emailAddress}
                error={errors.emailAddress}
                isEditing={isEditing}
                inputRef={emailAddressRef}
                onChange={(v) => patchDraft("emailAddress", v)}
              />
            </div>

            {/* Row 3: permanent address (full width) */}
            <PsgcAddressPicker
              key={`permanent-${session}`}
              id="permanentAddress"
              label="Home Address (Permanent)"
              value={
                isEditing
                  ? (draft.permanentAddress ?? info.permanentAddress)
                  : info.permanentAddress
              }
              readOnly={!isEditing}
              error={errors.permanentAddress}
              onChange={(v) => patchDraft("permanentAddress", v)}
            />

            {/* Row 4: current address (full width), optionally mirroring the permanent one */}
            <div className="mt-2">
              {isEditing && (
                <label htmlFor={sameId} className="mb-1 flex cursor-pointer items-center gap-2.5">
                  <input
                    id={sameId}
                    type="checkbox"
                    checked={sameAsPermanent}
                    onChange={(e) => toggleSame(e.target.checked)}
                    className="accent-brand-maroon size-4"
                  />
                  <span className="text-brand-ink text-sm font-medium">
                    Same as permanent address
                  </span>
                </label>
              )}
              <PsgcAddressPicker
                key={`current-${session}`}
                id="currentAddress"
                label="Current Residence Address"
                value={
                  sameAsPermanent
                    ? (draft.permanentAddress ?? info.permanentAddress)
                    : isEditing
                      ? (draft.currentAddress ?? info.currentAddress)
                      : info.currentAddress
                }
                readOnly={!isEditing}
                disabled={sameAsPermanent}
                error={errors.currentAddress}
                onChange={(v) => patchDraft("currentAddress", v)}
              />
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
