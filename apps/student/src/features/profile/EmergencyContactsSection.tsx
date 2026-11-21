import { ErrorAlert, Notice } from "@cbpupsis/ui";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import type { EmergencyContact } from "./profileTypes";
import { isNonEmpty, isValidAddress, isValidEmail, isValidPHPhone } from "./profileValidation";

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

const PlusIcon = () => (
  <SvgIcon>
    <path d="M12 5v14M5 12h14" />
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
const TrashIcon = () => (
  <SvgIcon>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
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
const WarningIcon = () => (
  <SvgIcon className="mt-0.5 size-4 shrink-0 text-amber-600">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </SvgIcon>
);

// ---- Types ----

type ContactFormData = Omit<EmergencyContact, "id">;
type FormErrors = Partial<Record<keyof ContactFormData, string>>;

const BLANK: ContactFormData = {
  fullName: "",
  relationship: "",
  phoneNumber: "",
  email: "",
  address: "",
  isPrimary: false,
};

const FIELD_ORDER: Array<keyof Omit<ContactFormData, "isPrimary">> = [
  "fullName",
  "relationship",
  "phoneNumber",
  "email",
  "address",
];

// ---- Validation ----

function validateContact(data: ContactFormData): FormErrors {
  const e: FormErrors = {};
  if (!isNonEmpty(data.fullName)) e.fullName = "Full name is required.";
  if (!isNonEmpty(data.relationship)) e.relationship = "Relationship is required.";
  if (!isValidPHPhone(data.phoneNumber))
    e.phoneNumber = "Enter a valid Philippine number (e.g. +63 912 345 6789 or 09XX XXX XXXX).";
  if (!isValidEmail(data.email)) e.email = "Enter a valid email address.";
  if (!isValidAddress(data.address))
    e.address = "Enter a complete address (at least 10 characters).";
  return e;
}

// ---- Dialog utilities ----

/** Opens a native dialog on mount; calls onNativeClose when it closes for any reason. */
function useNativeDialog(
  ref: React.RefObject<HTMLDialogElement | null>,
  onNativeClose: () => void,
  triggerEl: HTMLElement | null,
) {
  const onNativeCloseRef = useRef(onNativeClose);
  useEffect(() => {
    onNativeCloseRef.current = onNativeClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    try {
      dialog.showModal();
    } catch {
      // already open
    }
    function handleClose() {
      onNativeCloseRef.current();
    }
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
      // Return focus to the element that triggered the dialog.
      triggerEl?.focus();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

// ---- Shared form field ----

function FormField({
  id,
  label,
  type = "text",
  value,
  error,
  inputRef,
  onChange,
  required = true,
}: {
  id: string;
  label: string;
  type?: "text" | "email" | "tel";
  value: string;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-brand-ink text-sm font-semibold">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={id}
        type={type}
        value={value}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "text-brand-ink w-full rounded-xl border px-4 py-2.5 text-sm",
          "focus-visible:ring-brand-maroon focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
          error
            ? "border-red-500 focus-visible:ring-red-600"
            : "border-brand-border/60 focus-visible:border-brand-maroon",
        ].join(" ")}
      />
      <p
        id={errorId}
        role={error ? "alert" : undefined}
        className="min-h-[1rem] text-xs text-red-600"
      >
        {error}
      </p>
    </div>
  );
}

// ---- Contact form dialog (add / edit) ----

interface ContactFormDialogProps {
  mode: "add" | "edit";
  initial: ContactFormData;
  hasPrimaryAlready: boolean;
  triggerEl: HTMLElement | null;
  onSave: (data: ContactFormData) => void;
  onClose: () => void;
}

function ContactFormDialog({
  mode,
  initial,
  hasPrimaryAlready,
  triggerEl,
  onSave,
  onClose,
}: ContactFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useNativeDialog(dialogRef, onClose, triggerEl);

  const [draft, setDraft] = useState<ContactFormData>(initial);
  const [errors, setErrors] = useState<FormErrors>({});

  const fullNameRef = useRef<HTMLInputElement>(null);
  const relationshipRef = useRef<HTMLInputElement>(null);
  const phoneNumberRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  function patch<K extends keyof ContactFormData>(key: K, value: ContactFormData[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validateContact(draft);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstKey = FIELD_ORDER.find((k) => errs[k]);
      if (firstKey) {
        const inputRefs: Record<
          (typeof FIELD_ORDER)[number],
          React.RefObject<HTMLInputElement | null>
        > = {
          fullName: fullNameRef,
          relationship: relationshipRef,
          phoneNumber: phoneNumberRef,
          email: emailRef,
          address: addressRef,
        };
        inputRefs[firstKey].current?.focus();
      }
      return;
    }
    onSave(draft);
    dialogRef.current?.close();
  }

  const titleId = `contact-form-title-${mode}`;
  const title = mode === "add" ? "Add Emergency Contact" : "Edit Emergency Contact";
  const primaryWillChange = draft.isPrimary && hasPrimaryAlready && mode === "add";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="border-brand-border/25 [&::backdrop]:bg-brand-ink/50 m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border bg-white p-0 shadow-2xl"
    >
      {/* Dialog header */}
      <div className="border-brand-border/20 flex items-center justify-between border-b px-6 py-4">
        <h2 id={titleId} className="text-brand-ink text-base font-bold">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Close dialog"
          className="text-brand-muted hover:text-brand-ink focus-visible:outline-brand-maroon grid size-9 place-items-center rounded-lg transition-colors"
          onClick={() => dialogRef.current?.close()}
        >
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Form */}
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-0 px-6 pt-5 pb-6">
        {/* Row 1: name + relationship */}
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <FormField
            id="ec-fullName"
            label="Full Name"
            value={draft.fullName}
            error={errors.fullName}
            inputRef={fullNameRef}
            onChange={(v) => patch("fullName", v)}
          />
          <FormField
            id="ec-relationship"
            label="Relationship"
            value={draft.relationship}
            error={errors.relationship}
            inputRef={relationshipRef}
            onChange={(v) => patch("relationship", v)}
          />
        </div>

        {/* Row 2: phone + email */}
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <FormField
            id="ec-phoneNumber"
            label="Phone Number"
            type="tel"
            value={draft.phoneNumber}
            error={errors.phoneNumber}
            inputRef={phoneNumberRef}
            onChange={(v) => patch("phoneNumber", v)}
          />
          <FormField
            id="ec-email"
            label="Email Address"
            type="email"
            value={draft.email}
            error={errors.email}
            inputRef={emailRef}
            onChange={(v) => patch("email", v)}
          />
        </div>

        {/* Row 3: address (full width) */}
        <FormField
          id="ec-address"
          label="Address"
          value={draft.address}
          error={errors.address}
          inputRef={addressRef}
          onChange={(v) => patch("address", v)}
        />

        {/* Set as primary checkbox */}
        <div className="mt-1 mb-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              id="ec-isPrimary"
              type="checkbox"
              checked={draft.isPrimary}
              onChange={(e) => patch("isPrimary", e.target.checked)}
              className="accent-brand-maroon mt-0.5 size-4"
            />
            <span className="text-sm">
              <span className="text-brand-ink font-medium">Set as primary contact</span>
              {primaryWillChange && (
                <span className="text-brand-muted ml-1 text-xs">
                  (will replace the current primary)
                </span>
              )}
            </span>
          </label>
        </div>

        {/* Actions — "OK" commits to draft; final save happens via the section Save icon */}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="bg-brand-maroon hover:bg-brand-maroon-dark focus-visible:ring-brand-maroon min-h-11 rounded-xl px-6 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            OK
          </button>
          <button
            type="button"
            className="border-brand-border/60 text-brand-ink focus-visible:ring-brand-maroon min-h-11 rounded-xl border px-6 text-sm font-semibold transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}

// ---- Delete confirmation dialog ----

interface ConfirmRemoveDialogProps {
  contactName: string;
  isPrimary: boolean;
  triggerEl: HTMLElement | null;
  onConfirm: () => void;
  onClose: () => void;
}

function ConfirmRemoveDialog({
  contactName,
  isPrimary,
  triggerEl,
  onConfirm,
  onClose,
}: ConfirmRemoveDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useNativeDialog(dialogRef, onClose, triggerEl);

  const titleId = "confirm-remove-title";
  const descId = "confirm-remove-desc";

  function handleConfirm() {
    onConfirm();
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="border-brand-border/25 [&::backdrop]:bg-brand-ink/50 m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border bg-white p-6 shadow-2xl"
    >
      <h2 id={titleId} className="text-brand-ink text-base font-bold">
        Delete Emergency Contact
      </h2>

      <p id={descId} className="text-brand-muted mt-2 text-sm leading-relaxed">
        Are you sure you want to remove{" "}
        <span className="text-brand-ink font-semibold">{contactName}</span> from your emergency
        contacts? This action cannot be undone.
      </p>

      {isPrimary && (
        <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <WarningIcon />
          <p className="text-xs leading-relaxed text-amber-800">
            This is your primary emergency contact. Consider designating another contact as primary
            before removing.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-11 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:outline-none"
          onClick={handleConfirm}
        >
          Delete
        </button>
        <button
          type="button"
          className="border-brand-border/60 text-brand-ink focus-visible:ring-brand-maroon min-h-11 rounded-xl border px-5 text-sm font-semibold transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          onClick={() => dialogRef.current?.close()}
        >
          Cancel
        </button>
      </div>
    </dialog>
  );
}

// ---- Contact card ----

interface ContactCardProps {
  contact: EmergencyContact;
  isManageMode: boolean;
  onEdit: (el: HTMLElement) => void;
  onDelete: (el: HTMLElement) => void;
}

function ContactCard({ contact, isManageMode, onEdit, onDelete }: ContactCardProps) {
  const interactiveProps = isManageMode
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": `Edit emergency contact: ${contact.fullName}`,
        onClick: (e: React.MouseEvent<HTMLElement>) => onEdit(e.currentTarget),
        onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit(e.currentTarget);
          }
        },
      }
    : {};

  return (
    <article
      {...interactiveProps}
      className={[
        "relative rounded-2xl border bg-white p-5 shadow-sm",
        isManageMode
          ? "border-brand-border/25 hover:border-brand-maroon/40 focus-visible:outline-brand-maroon cursor-pointer transition-all hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          : "border-brand-border/25",
      ].join(" ")}
    >
      {/* Trash icon — only in manage mode */}
      {isManageMode && (
        <button
          type="button"
          aria-label={`Delete emergency contact: ${contact.fullName}`}
          className="text-brand-muted absolute top-3 right-3 grid size-9 place-items-center rounded-lg transition-colors hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(e.currentTarget);
          }}
        >
          <TrashIcon />
        </button>
      )}

      {/* 2-column content grid: left = name/phone/address, right = relationship/email */}
      <dl className={`grid grid-cols-2 gap-x-4 ${isManageMode ? "pr-[4.5rem]" : ""}`}>
        {/* Left column */}
        <div className="min-w-0">
          <dt className="sr-only">Name</dt>
          <dd className="text-brand-maroon truncate text-sm font-bold sm:text-base">
            {contact.fullName}
          </dd>
          <dt className="sr-only">Phone</dt>
          <dd className="text-brand-ink mt-1 text-sm">{contact.phoneNumber}</dd>
          <dt className="sr-only">Address</dt>
          <dd className="text-brand-muted mt-1 text-xs leading-snug">{contact.address}</dd>
        </div>

        {/* Right column */}
        <div className="min-w-0 text-right">
          <dt className="sr-only">Relationship</dt>
          <dd className="text-brand-muted text-sm font-medium">{contact.relationship}</dd>
          <dt className="sr-only">Email</dt>
          <dd className="text-brand-ink mt-1 text-sm break-all">{contact.email}</dd>
        </div>
      </dl>
    </article>
  );
}

// ---- Main section ----

interface EmergencyContactsSectionProps {
  contacts: EmergencyContact[];
  /** Rejects with the API's error; manage mode stays open so nothing typed is lost. */
  onSaveAll: (contacts: EmergencyContact[]) => Promise<void>;
}

type DialogState =
  | { kind: "add"; triggerEl: HTMLElement }
  | { kind: "edit"; contact: EmergencyContact; triggerEl: HTMLElement }
  | { kind: "remove"; contact: EmergencyContact; triggerEl: HTMLElement }
  | null;

export function EmergencyContactsSection({ contacts, onSaveAll }: EmergencyContactsSectionProps) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [savedKey, setSavedKey] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [isManageMode, setIsManageMode] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Local draft buffer — changes are committed only when the save icon is clicked.
  const [draftContacts, setDraftContacts] = useState<EmergencyContact[]>(contacts);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  // Outside manage mode the list is what the API holds; the draft exists only while editing.
  const shownContacts = isManageMode ? draftContacts : contacts;

  const hasPrimary = draftContacts.some((c) => c.isPrimary);
  const CONTENT_ID = "emergency-contacts-content";

  function getIsDirty(): boolean {
    if (draftContacts.length !== contacts.length) return true;
    for (const dc of draftContacts) {
      const orig = contacts.find((c) => c.id === dc.id);
      if (!orig) return true;
      if (
        dc.fullName !== orig.fullName ||
        dc.relationship !== orig.relationship ||
        dc.phoneNumber !== orig.phoneNumber ||
        dc.email !== orig.email ||
        dc.address !== orig.address ||
        dc.isPrimary !== orig.isPrimary
      )
        return true;
    }
    return false;
  }

  function exitManageMode() {
    setIsManageMode(false);
  }

  function toggleOpen() {
    if (isOpen) {
      // Discard any unsaved draft changes when collapsing.
      setDraftContacts(contacts);
      exitManageMode();
    }
    setIsOpen((o) => !o);
  }

  function enterManageMode() {
    setDraftContacts(contacts);
    setSaveError(null);
    setIsManageMode(true);
  }

  async function handleSave() {
    if (saving) return;
    if (getIsDirty()) {
      setSaving(true);
      setSaveError(null);
      try {
        await onSaveAll(draftContacts);
      } catch (error) {
        setSaveError(error);
        return;
      } finally {
        setSaving(false);
      }
      setSavedKey((n) => n + 1);
    }
    exitManageMode();
    editButtonRef.current?.focus();
  }

  // Draft-only add — applies primary mutex within the draft.
  function draftAdd(data: ContactFormData) {
    const id = `ec-${crypto.randomUUID()}`;
    setDraftContacts((prev) => {
      const base = data.isPrimary ? prev.map((c) => ({ ...c, isPrimary: false })) : prev;
      return [...base, { ...data, id }];
    });
  }

  // Draft-only update — applies primary mutex within the draft.
  function draftUpdate(id: string, data: ContactFormData) {
    setDraftContacts((prev) => {
      const base = data.isPrimary
        ? prev.map((c) => (c.id !== id && c.isPrimary ? { ...c, isPrimary: false } : c))
        : prev;
      return base.map((c) => (c.id === id ? { ...c, ...data } : c));
    });
  }

  // Draft-only remove.
  function draftRemove(id: string) {
    setDraftContacts((prev) => prev.filter((c) => c.id !== id));
  }

  function handleAdd(data: ContactFormData) {
    draftAdd(data);
    setDialog(null);
    // Stay in manage mode — changes are buffered until the save icon is clicked.
  }

  function handleUpdate(data: ContactFormData) {
    if (dialog?.kind !== "edit") return;
    draftUpdate(dialog.contact.id, data);
    setDialog(null);
    // Stay in manage mode.
  }

  function handleRemove() {
    if (dialog?.kind !== "remove") return;
    const id = dialog.contact.id;
    setDialog(null);
    setRemovingId(id);
    // Remove from draft after the exit animation finishes; stay in manage mode.
    setTimeout(() => {
      draftRemove(id);
      setRemovingId(null);
    }, 350);
  }

  return (
    <section aria-labelledby="emergency-contacts-heading">
      {savedKey > 0 && (
        <Notice key={savedKey} tone="success">
          Emergency contacts updated successfully.
        </Notice>
      )}
      {saveError !== null && (
        <ErrorAlert error={saveError} title="Emergency contacts were not saved" />
      )}

      {/* Section header — mirrors PersonalInfoSection layout */}
      <div className="flex items-center justify-between gap-4">
        <h2
          id="emergency-contacts-heading"
          className="text-brand-ink text-xl font-bold tracking-tight"
        >
          Emergency Contacts
        </h2>

        <div className="flex items-center gap-1">
          {/* Pencil — visible when section is open and NOT in manage mode */}
          {isOpen && !isManageMode && (
            <button
              ref={editButtonRef}
              type="button"
              aria-label="Edit emergency contacts"
              className="text-brand-muted hover:text-brand-maroon focus-visible:outline-brand-maroon grid min-h-11 min-w-11 place-items-center rounded-lg transition-colors"
              onClick={enterManageMode}
            >
              <EditIcon />
            </button>
          )}
          {/* Save icon — replaces pencil when manage mode is active */}
          {isOpen && isManageMode && (
            <button
              type="button"
              aria-label="Save changes to emergency contacts"
              className="text-brand-muted hover:text-brand-maroon focus-visible:outline-brand-maroon grid min-h-11 min-w-11 place-items-center rounded-lg transition-colors"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              <SaveIcon />
            </button>
          )}
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={CONTENT_ID}
            aria-label={isOpen ? "Collapse emergency contacts" : "Expand emergency contacts"}
            className="text-brand-muted hover:text-brand-maroon focus-visible:outline-brand-maroon grid min-h-11 min-w-11 place-items-center rounded-lg transition-colors"
            onClick={toggleOpen}
          >
            <ChevronIcon open={isOpen} />
          </button>
        </div>
      </div>

      {/* Collapsible content — grid-template-rows trick for smooth CSS animation */}
      <div
        className="grid transition-all duration-300 ease-in-out motion-reduce:transition-none"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden" id={CONTENT_ID}>
          <div className="mt-4">
            {shownContacts.length === 0 && (
              <p className="text-brand-muted mb-4 text-sm">No emergency contacts added yet.</p>
            )}

            {/* Each card wrapped for slide-and-fade exit animation */}
            {shownContacts.map((contact) => {
              const isRemoving = removingId === contact.id;
              return (
                <div
                  key={contact.id}
                  className="grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
                  style={{ gridTemplateRows: isRemoving ? "0fr" : "1fr" }}
                >
                  <div
                    className={`overflow-hidden pb-4 transition-opacity duration-150 ease-out motion-reduce:transition-none ${
                      isRemoving ? "opacity-0" : ""
                    }`}
                  >
                    <ContactCard
                      contact={contact}
                      isManageMode={isManageMode}
                      onEdit={(el) => setDialog({ kind: "edit", contact, triggerEl: el })}
                      onDelete={(el) => setDialog({ kind: "remove", contact, triggerEl: el })}
                    />
                  </div>
                </div>
              );
            })}

            {/* Add button — only in manage mode */}
            {isManageMode && (
              <button
                type="button"
                className="border-brand-border/25 hover:border-brand-maroon/40 focus-visible:outline-brand-maroon flex min-h-[4.5rem] w-full items-center justify-center gap-3 rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md"
                onClick={(e) => setDialog({ kind: "add", triggerEl: e.currentTarget })}
              >
                <span
                  className="bg-brand-maroon grid size-8 shrink-0 place-items-center rounded-full text-white"
                  aria-hidden="true"
                >
                  <PlusIcon />
                </span>
                <span className="text-brand-maroon text-sm font-bold">Add Emergency Contact</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs — conditionally mounted so showModal() runs on mount */}
      {dialog?.kind === "add" && (
        <ContactFormDialog
          mode="add"
          initial={BLANK}
          hasPrimaryAlready={hasPrimary}
          triggerEl={dialog.triggerEl}
          onSave={handleAdd}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === "edit" && (
        <ContactFormDialog
          mode="edit"
          initial={{
            fullName: dialog.contact.fullName,
            relationship: dialog.contact.relationship,
            phoneNumber: dialog.contact.phoneNumber,
            email: dialog.contact.email,
            address: dialog.contact.address,
            isPrimary: dialog.contact.isPrimary,
          }}
          hasPrimaryAlready={hasPrimary}
          triggerEl={dialog.triggerEl}
          onSave={handleUpdate}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === "remove" && (
        <ConfirmRemoveDialog
          contactName={dialog.contact.fullName}
          isPrimary={dialog.contact.isPrimary}
          triggerEl={dialog.triggerEl}
          onConfirm={handleRemove}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
