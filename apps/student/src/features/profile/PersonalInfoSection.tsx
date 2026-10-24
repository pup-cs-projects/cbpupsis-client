import { Notice } from "@cbpupsis/ui";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import type { PersonalInformation } from "./profileTypes";
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
 * Immutable field with a contextual popover explaining why it cannot be changed.
 * Triggers on hover, click/tap, and keyboard focus. Dismisses on mouse-out,
 * click-outside, or Escape.
 */
function LockedFieldWithPopover({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: string;
}) {
  const [lockHovered, setLockHovered] = useState(false);
  const [fieldActive, setFieldActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isOpen = lockHovered || fieldActive;
  const popoverId = `${id}-info`;

  function closeAll() {
    setLockHovered(false);
    setFieldActive(false);
  }

  useEffect(() => {
    if (!isOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) closeAll();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeAll();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-brand-ink text-sm font-semibold">
        {label}
      </label>

      <div className="relative cursor-default">
        <input
          id={id}
          type="text"
          value={value}
          readOnly
          aria-readonly="true"
          aria-describedby={popoverId}
          onClick={() => setFieldActive(true)}
          onFocus={() => setFieldActive(true)}
          onBlur={() => setFieldActive(false)}
          className="border-brand-border/30 text-brand-ink focus-visible:ring-brand-maroon/50 w-full cursor-not-allowed rounded-xl border bg-neutral-100 px-4 py-3 pr-10 text-sm select-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
        />
        <span
          aria-hidden="true"
          className="text-brand-muted absolute top-1/2 right-3 -translate-y-1/2"
          onMouseEnter={() => setLockHovered(true)}
          onMouseLeave={() => setLockHovered(false)}
        >
          <LockIcon />
        </span>
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
        {/* Caret pointing up toward the input */}
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

type EditableKeys = "phoneNumber" | "personalEmail" | "homeAddress" | "currentResidence";
type Draft = Pick<PersonalInformation, EditableKeys>;
type FieldErrors = Partial<Record<EditableKeys, string>>;

const FIELD_ORDER: EditableKeys[] = [
  "phoneNumber",
  "personalEmail",
  "homeAddress",
  "currentResidence",
];

// ---- Main component ----

interface PersonalInfoSectionProps {
  info: PersonalInformation;
  onSave: (patch: Draft) => void;
}

export function PersonalInfoSection({ info, onSave }: PersonalInfoSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    phoneNumber: info.phoneNumber,
    personalEmail: info.personalEmail,
    homeAddress: info.homeAddress,
    currentResidence: info.currentResidence,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  // Each increment forces Notice to remount so saving twice re-shows the toast.
  const [savedKey, setSavedKey] = useState(0);

  // Refs for focus management.
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const phoneNumberRef = useRef<HTMLInputElement>(null);
  const personalEmailRef = useRef<HTMLInputElement>(null);
  const homeAddressRef = useRef<HTMLInputElement>(null);
  const currentResidenceRef = useRef<HTMLInputElement>(null);

  function patchDraft(key: EditableKeys, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    // Clear the field's error as soon as the user types.
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!isValidPHPhone(draft.phoneNumber)) {
      e.phoneNumber = "Enter a valid Philippine number (e.g. +63 912 345 6789 or 09XX XXX XXXX).";
    }
    if (!isValidEmail(draft.personalEmail)) {
      e.personalEmail = "Enter a valid email address.";
    }
    if (!isValidAddress(draft.homeAddress)) {
      e.homeAddress = "Enter a complete address (at least 10 characters).";
    }
    if (!isValidAddress(draft.currentResidence)) {
      e.currentResidence = "Enter a current residence address (at least 10 characters).";
    }
    return e;
  }

  function startEdit() {
    setDraft({
      phoneNumber: info.phoneNumber,
      personalEmail: info.personalEmail,
      homeAddress: info.homeAddress,
      currentResidence: info.currentResidence,
    });
    setErrors({});
    setIsEditing(true);
  }

  const isDirty =
    draft.phoneNumber !== info.phoneNumber ||
    draft.personalEmail !== info.personalEmail ||
    draft.homeAddress !== info.homeAddress ||
    draft.currentResidence !== info.currentResidence;

  function handleSave() {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      const firstKey = FIELD_ORDER.find((k) => e[k]);
      if (firstKey) {
        const inputRefs: Record<EditableKeys, React.RefObject<HTMLInputElement | null>> = {
          phoneNumber: phoneNumberRef,
          personalEmail: personalEmailRef,
          homeAddress: homeAddressRef,
          currentResidence: currentResidenceRef,
        };
        inputRefs[firstKey].current?.focus();
      }
      return;
    }
    if (isDirty) {
      onSave(draft);
      setSavedKey((n) => n + 1);
    }
    setIsEditing(false);
    editButtonRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSave();
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
              className="text-brand-muted hover:text-brand-maroon focus-visible:outline-brand-maroon grid min-h-11 min-w-11 place-items-center rounded-lg transition-colors"
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
            {/* Row 1: locked fields — hover/click/focus reveals the registrar info popover */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2">
              <LockedFieldWithPopover
                id="fullLegalName"
                label="Full Legal Name"
                value={info.fullLegalName}
              />
              <LockedFieldWithPopover
                id="academicProgram"
                label="Academic Program"
                value={info.program}
              />
            </div>

            {/* Row 2: phone + email */}
            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2">
              <ProfileField
                id="phoneNumber"
                label="Phone Number"
                type="tel"
                value={draft.phoneNumber}
                error={errors.phoneNumber}
                isEditing={isEditing}
                inputRef={phoneNumberRef}
                onChange={(v) => patchDraft("phoneNumber", v)}
              />
              <ProfileField
                id="personalEmail"
                label="Email Address"
                type="email"
                value={draft.personalEmail}
                error={errors.personalEmail}
                isEditing={isEditing}
                inputRef={personalEmailRef}
                onChange={(v) => patchDraft("personalEmail", v)}
              />
            </div>

            {/* Row 3: home address (full width) */}
            <div className="mt-1">
              <ProfileField
                id="homeAddress"
                label="Home Address (Permanent)"
                value={draft.homeAddress}
                error={errors.homeAddress}
                isEditing={isEditing}
                inputRef={homeAddressRef}
                onChange={(v) => patchDraft("homeAddress", v)}
              />
            </div>

            {/* Row 4: current residence (full width) */}
            <div className="mt-1">
              <ProfileField
                id="currentResidence"
                label="Current Residence Address"
                value={draft.currentResidence}
                error={errors.currentResidence}
                isEditing={isEditing}
                inputRef={currentResidenceRef}
                onChange={(v) => patchDraft("currentResidence", v)}
              />
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
