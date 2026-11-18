import { fieldErrors } from "@cbpupsis/shared/api";
import { MAX_EMERGENCY_CONTACTS } from "@cbpupsis/shared/profile";
import { ErrorAlert, ModalDialog, Notice } from "@cbpupsis/ui";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { PsgcAddressPicker } from "./PsgcAddressPicker";
import type { EmergencyContact, EmergencyContactDraft } from "./profileTypes";
import { isNonEmpty, isSameContact, isValidEmail, isValidPHPhone } from "./profileValidation";

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
const DoneIcon = () => (
  <SvgIcon>
    <path d="M20 6L9 17l-5-5" />
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

type FormErrors = Partial<Record<keyof EmergencyContactDraft | "form", string>>;

const BLANK: EmergencyContactDraft = {
  name: "",
  relationship: "",
  phone: "",
  email: "",
  address: "",
  isPrimary: false,
};

const DUPLICATE = "A contact with this name and phone number already exists.";
const AT_CAP = `You can keep at most ${MAX_EMERGENCY_CONTACTS} emergency contacts. Remove one to add another.`;

// ---- Validation ----

/**
 * What stops this contact being saved before any request is made. `editingId` is the contact
 * being edited, which is not a duplicate of itself. `address` is `null` while its picker is
 * half-filled; an address is optional, but a half-built one is never saved.
 */
function validateContact(
  data: EmergencyContactDraft,
  address: string | null,
  others: EmergencyContact[],
  editingId: string | null,
): FormErrors {
  const e: FormErrors = {};
  if (editingId === null && others.length >= MAX_EMERGENCY_CONTACTS) e.form = AT_CAP;
  if (!isNonEmpty(data.name)) e.name = "Full name is required.";
  if (!isNonEmpty(data.relationship)) e.relationship = "Relationship is required.";
  if (!isValidPHPhone(data.phone)) {
    e.phone = "Enter a valid Philippine number (e.g. +63 912 345 6789 or 09XX XXX XXXX).";
  }
  if (!isValidEmail(data.email)) e.email = "Enter a valid email address.";
  if (address === null) e.address = "Choose every part of the address, or keep the current one.";
  if (!e.name && !e.phone && others.some((c) => c.id !== editingId && isSameContact(c, data))) {
    e.phone = DUPLICATE;
  }
  return e;
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
  initialFocus = false,
}: {
  id: string;
  label: string;
  type?: "text" | "email" | "tel";
  value: string;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onChange: (v: string) => void;
  initialFocus?: boolean;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-brand-ink text-sm font-semibold">
        {label}
        <span className="ml-0.5 text-red-600" aria-hidden="true">
          *
        </span>
      </label>
      <input
        ref={inputRef}
        id={id}
        name={id}
        type={type}
        value={value}
        required
        data-initial-focus={initialFocus ? "" : undefined}
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
  /** The contact being edited, or null when adding. */
  editing: EmergencyContact | null;
  /** Every contact the student has now, for the duplicate and cap checks. */
  contacts: EmergencyContact[];
  /** Rejects with the API's error; the dialog stays open so nothing typed is lost. */
  onSave: (id: string | null, data: EmergencyContactDraft) => Promise<void>;
  onClose: () => void;
}

function ContactFormDialog({ editing, contacts, onSave, onClose }: ContactFormDialogProps) {
  const [draft, setDraft] = useState<EmergencyContactDraft>(
    editing
      ? {
          name: editing.name,
          relationship: editing.relationship,
          phone: editing.phone,
          email: editing.email,
          address: editing.address,
          isPrimary: editing.isPrimary,
        }
      : BLANK,
  );
  // `null` while the address picker is half-filled; otherwise what will be saved.
  const [address, setAddress] = useState<string | null>(draft.address);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  // State updates lag a fast double click; a ref closes that gap.
  const inFlight = useRef(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const relationshipRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const title = editing ? "Edit Emergency Contact" : "Add Emergency Contact";
  const otherPrimary = contacts.some((c) => c.isPrimary && c.id !== editing?.id);
  const primaryWillChange = draft.isPrimary && otherPrimary;

  function patch<K extends keyof EmergencyContactDraft>(key: K, value: EmergencyContactDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key] || errors.form)
      setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
  }

  function focusFirst(e: FormErrors) {
    const target = e.name
      ? nameRef
      : e.relationship
        ? relationshipRef
        : e.phone
          ? phoneRef
          : e.email
            ? emailRef
            : null;
    target?.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const errs = validateContact(draft, address, contacts, editing?.id ?? null);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      focusFirst(errs);
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(editing?.id ?? null, { ...draft, address: address ?? "" });
      onClose();
    } catch (error) {
      // A reason the API tied to one field goes under that field; anything else is a banner.
      const reasons = fieldErrors(error);
      const mine: FormErrors = {};
      if (reasons.name) mine.name = reasons.name;
      if (reasons.relationship) mine.relationship = reasons.relationship;
      if (reasons.phone) mine.phone = reasons.phone;
      if (reasons.email ?? reasons.emailAddress) mine.email = reasons.email ?? reasons.emailAddress;
      if (reasons.address) mine.address = reasons.address;
      if (reasons.isPrimary) mine.isPrimary = reasons.isPrimary;
      if (Object.keys(mine).length > 0) {
        setErrors(mine);
        focusFirst(mine);
      } else {
        setSaveError(error);
      }
      inFlight.current = false;
      setSaving(false);
    }
  }

  // Escape closes the dialog. A select uses Escape to dismiss its own list, so leave it alone.
  // Listening on the document keeps this working wherever focus is inside the dialog.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || saving) return;
      if (event.target instanceof HTMLSelectElement) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [saving, onClose]);

  return (
    <ModalDialog open title={title} busy={saving} onClose={onClose}>
      <form noValidate onSubmit={(e) => void handleSubmit(e)} className="mt-4 flex flex-col gap-0">
        {saveError !== null && (
          <ErrorAlert error={saveError} title="This emergency contact was not saved" />
        )}
        {errors.form && (
          <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.form}
          </p>
        )}

        {/* Row 1: name + relationship */}
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <FormField
            id="ec-name"
            label="Full Name"
            value={draft.name}
            error={errors.name}
            inputRef={nameRef}
            initialFocus
            onChange={(v) => patch("name", v)}
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
            id="ec-phone"
            label="Phone Number"
            type="tel"
            value={draft.phone}
            error={errors.phone}
            inputRef={phoneRef}
            onChange={(v) => patch("phone", v)}
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

        {/* Row 3: optional address, the same PSGC picker the profile uses */}
        <PsgcAddressPicker
          id="ec-address"
          label="Address"
          value={address ?? draft.address}
          required={false}
          hint="Optional"
          error={errors.address}
          onChange={(v) => {
            setAddress(v);
            if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
          }}
        />

        {/* Primary contact checkbox */}
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
              <span className="text-brand-ink font-medium">Primary contact</span>
              {primaryWillChange && (
                <span className="text-brand-muted ml-1 text-xs">
                  (will replace the current primary)
                </span>
              )}
            </span>
          </label>
          {errors.isPrimary && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {errors.isPrimary}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-maroon hover:bg-brand-maroon-dark focus-visible:ring-brand-maroon min-h-11 rounded-xl px-6 text-sm font-semibold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save contact"}
          </button>
          <button
            type="button"
            disabled={saving}
            className="border-brand-border/60 text-brand-ink focus-visible:ring-brand-maroon min-h-11 rounded-xl border px-6 text-sm font-semibold transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

// ---- Delete confirmation dialog ----

function ConfirmRemoveDialog({
  contact,
  onConfirm,
  onClose,
}: {
  contact: EmergencyContact;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ModalDialog open title="Delete Emergency Contact" onClose={onClose}>
      <p className="text-brand-muted mt-2 text-sm leading-relaxed">
        Are you sure you want to remove{" "}
        <span className="text-brand-ink font-semibold">{contact.name}</span> from your emergency
        contacts? This action cannot be undone.
      </p>

      {contact.isPrimary && (
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
          data-initial-focus
          className="min-h-11 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:outline-none"
          onClick={onConfirm}
        >
          Delete
        </button>
        <button
          type="button"
          className="border-brand-border/60 text-brand-ink focus-visible:ring-brand-maroon min-h-11 rounded-xl border px-5 text-sm font-semibold transition-colors hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </ModalDialog>
  );
}

// ---- Contact card ----

interface ContactCardProps {
  contact: EmergencyContact;
  isManageMode: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function ContactCard({ contact, isManageMode, onEdit, onDelete }: ContactCardProps) {
  const interactiveProps = isManageMode
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": `Edit emergency contact: ${contact.name}`,
        onClick: onEdit,
        onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
          // A key pressed on the delete button inside the card is that button's, not the card's.
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit();
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
          aria-label={`Delete emergency contact: ${contact.name}`}
          className="text-brand-muted absolute top-3 right-3 grid size-9 place-items-center rounded-lg transition-colors hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
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
          <dd className="text-brand-maroon flex items-center gap-2 text-sm font-bold sm:text-base">
            <span className="truncate">{contact.name}</span>
            {contact.isPrimary && (
              <span className="bg-brand-maroon/10 text-brand-maroon shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold">
                Primary
              </span>
            )}
          </dd>
          <dt className="sr-only">Phone</dt>
          <dd className="text-brand-ink mt-1 text-sm">{contact.phone}</dd>
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
  /** Creates (id null) or updates one contact. Rejects with the API's error. */
  onSave: (id: string | null, contact: EmergencyContactDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

type DialogState =
  | { kind: "form"; contact: EmergencyContact | null }
  | { kind: "remove"; contact: EmergencyContact }
  | null;

export function EmergencyContactsSection({
  contacts,
  onSave,
  onDelete,
}: EmergencyContactsSectionProps) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [savedKey, setSavedKey] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [isManageMode, setIsManageMode] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<unknown>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  const atCap = contacts.length >= MAX_EMERGENCY_CONTACTS;
  const CONTENT_ID = "emergency-contacts-content";

  function toggleOpen() {
    if (isOpen) setIsManageMode(false);
    setIsOpen((o) => !o);
  }

  function openAdd() {
    // The button is hidden at the cap; this keeps a stale click from opening a doomed form.
    if (atCap) return;
    setDialog({ kind: "form", contact: null });
  }

  async function handleSave(id: string | null, data: EmergencyContactDraft) {
    await onSave(id, data);
    setSavedKey((n) => n + 1);
  }

  async function handleRemove() {
    if (dialog?.kind !== "remove") return;
    const id = dialog.contact.id;
    setDialog(null);
    setRemovingId(id);
    setRemoveError(null);
    try {
      await onDelete(id);
    } catch (error) {
      setRemoveError(error);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section aria-labelledby="emergency-contacts-heading">
      {savedKey > 0 && (
        <Notice key={savedKey} tone="success">
          Emergency contacts updated successfully.
        </Notice>
      )}
      {removeError !== null && (
        <ErrorAlert error={removeError} title="The emergency contact was not deleted" />
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
              onClick={() => {
                setRemoveError(null);
                setIsManageMode(true);
              }}
            >
              <EditIcon />
            </button>
          )}
          {/* Check — replaces the pencil in manage mode. Every change is already saved. */}
          {isOpen && isManageMode && (
            <button
              type="button"
              aria-label="Done editing emergency contacts"
              className="text-brand-muted hover:text-brand-maroon focus-visible:outline-brand-maroon grid min-h-11 min-w-11 place-items-center rounded-lg transition-colors"
              onClick={() => {
                setIsManageMode(false);
                editButtonRef.current?.focus();
              }}
            >
              <DoneIcon />
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
            {contacts.length === 0 && (
              <p className="text-brand-muted mb-4 text-sm">No emergency contacts added yet.</p>
            )}

            {/* Each card wrapped for slide-and-fade exit animation */}
            {contacts.map((contact) => {
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
                      onEdit={() => setDialog({ kind: "form", contact })}
                      onDelete={() => setDialog({ kind: "remove", contact })}
                    />
                  </div>
                </div>
              );
            })}

            {/* Add button — manage mode only, and only while there is room for another */}
            {isManageMode && !atCap && (
              <button
                type="button"
                className="border-brand-border/25 hover:border-brand-maroon/40 focus-visible:outline-brand-maroon flex min-h-[4.5rem] w-full items-center justify-center gap-3 rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md"
                onClick={openAdd}
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
            {isManageMode && atCap && (
              <p className="text-brand-muted text-sm">
                You have the maximum of {MAX_EMERGENCY_CONTACTS} emergency contacts. Delete one to
                add another.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs — conditionally mounted so showModal() runs on mount */}
      {dialog?.kind === "form" && (
        <ContactFormDialog
          // A different contact is a fresh form, never the previous one's draft.
          key={dialog.contact?.id ?? "new"}
          editing={dialog.contact}
          contacts={contacts}
          onSave={handleSave}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === "remove" && (
        <ConfirmRemoveDialog
          contact={dialog.contact}
          onConfirm={() => void handleRemove()}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
