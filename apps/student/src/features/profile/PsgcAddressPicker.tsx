import {
  citiesOf,
  formatAddress,
  isNcr,
  loadProvinces,
  PSGC_REGIONS,
  type PsgcProvince,
} from "@cbpupsis/shared/psgc";
import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from "react";

interface Parts {
  regionId: string;
  province: string;
  city: string;
  barangay: string;
  street: string;
}

const EMPTY: Parts = { regionId: "", province: "", city: "", barangay: "", street: "" };

function isComplete(p: Parts): boolean {
  return Boolean(
    p.regionId && (isNcr(p.regionId) || p.province) && p.city && p.barangay && p.street.trim(),
  );
}

const CONTROL =
  "text-brand-ink w-full rounded-xl border bg-white px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-neutral-100 " +
  "focus-visible:ring-brand-maroon focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none";

function Select({
  id,
  selectRef,
  label,
  value,
  placeholder,
  disabled,
  invalid,
  describedBy,
  options,
  onChange,
}: {
  id: string;
  selectRef?: React.Ref<HTMLSelectElement>;
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  invalid: boolean;
  describedBy?: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-brand-muted text-xs font-semibold">
        {label}
      </label>
      <select
        ref={selectRef}
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        className={`${CONTROL} ${invalid ? "border-red-500" : "border-brand-border/60"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface PsgcAddressPickerProps {
  /** Unique within the page; prefixes every control's id. */
  id: string;
  label: string;
  /**
   * The address currently in effect: the saved one until the student picks a new one, then the
   * joined line. The picker never rewrites it unless the student chose a full address.
   */
  value: string;
  /**
   * A full address (`value` as saved, or the new joined line), or `null` while the student is
   * partway through choosing one, so the form can refuse to save a half-built address.
   */
  onChange: (next: string | null) => void;
  error?: string;
  /** Show the address as plain text with no Edit button, e.g. outside the form's edit mode. */
  readOnly?: boolean;
  /** Show the address as muted text that cannot be edited, e.g. while it mirrors another. */
  disabled?: boolean;
  required?: boolean;
  /** Shown beside the label, e.g. `Optional`. */
  hint?: ReactNode;
}

/**
 * Offline PSGC address picker: Region -> Province -> City / Municipality -> Barangay, then a
 * free-text House No. & Street, saved as one comma-separated line. NCR has no provinces, so its
 * cities follow the region directly. An existing address shows as plain text and the picker
 * opens only when the student presses Edit; left alone, the saved string is kept as it is.
 */
export function PsgcAddressPicker({
  id,
  label,
  value,
  onChange,
  error,
  readOnly = false,
  disabled = false,
  required = true,
  hint,
}: PsgcAddressPickerProps) {
  // The address on file when this picker mounted: what Edit replaces and Cancel restores.
  const [original] = useState(value);
  const [editing, setEditing] = useState(original.trim() === "");
  const [parts, setParts] = useState<Parts>(EMPTY);
  // Every region fetched so far, so a slow load for one region cannot clobber another.
  const [loaded, setLoaded] = useState<Record<string, PsgcProvince[]>>({});
  const [loadFailed, setLoadFailed] = useState<string | null>(null);

  // The button that was just pressed unmounts, so focus moves to what replaces it.
  const regionRef = useRef<HTMLSelectElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"region" | "edit" | null>(null);
  useEffect(() => {
    if (focusNext.current === "region") regionRef.current?.focus();
    if (focusNext.current === "edit") editRef.current?.focus();
    focusNext.current = null;
  });

  const labelId = useId();
  const errorId = `${id}-error`;
  const hasOriginal = original.trim() !== "";
  const showPicker = !readOnly && !disabled && editing;
  const provinces = loaded[parts.regionId] ?? null;
  const ncr = isNcr(parts.regionId);
  const cityProvince = ncr ? (provinces?.[0]?.name ?? "") : parts.province;
  const cities = provinces ? citiesOf(provinces, cityProvince) : [];
  const barangays = cities.find((c) => c.name === parts.city)?.barangays ?? [];

  function commit(next: Parts) {
    setParts(next);
    if (isComplete(next)) {
      onChange(
        formatAddress({
          street: next.street,
          barangay: next.barangay,
          city: next.city,
          province: isNcr(next.regionId) ? "" : next.province,
          regionId: next.regionId,
        }),
      );
    } else if (!hasOriginal && !next.regionId && !next.street.trim()) {
      onChange("");
    } else {
      onChange(null);
    }
  }

  function load(regionId: string) {
    setLoadFailed(null);
    loadProvinces(regionId).then(
      (list) => setLoaded((prev) => ({ ...prev, [regionId]: list })),
      () => setLoadFailed(regionId),
    );
  }

  function changeRegion(regionId: string) {
    commit({ ...parts, regionId, province: "", city: "", barangay: "" });
    if (regionId) load(regionId);
  }

  function startEditing() {
    focusNext.current = "region";
    setEditing(true);
    setParts(EMPTY);
  }

  function cancelEditing() {
    focusNext.current = "edit";
    setEditing(false);
    setParts(EMPTY);
    onChange(original);
  }

  const describedBy = error ? errorId : undefined;
  const loading = parts.regionId !== "" && provinces === null && loadFailed !== parts.regionId;

  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={describedBy} className="mt-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span id={labelId} className="text-brand-ink text-sm font-semibold">
          {label}
          {required && !readOnly && (
            <span className="ml-0.5 text-red-600" aria-hidden="true">
              *
            </span>
          )}
        </span>
        {hint && !readOnly && <span className="text-brand-muted text-xs">{hint}</span>}
      </div>

      {showPicker ? (
        <div className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <Select
            id={`${id}-region`}
            selectRef={regionRef}
            label="Region"
            value={parts.regionId}
            placeholder="Select region"
            invalid={Boolean(error)}
            describedBy={describedBy}
            options={PSGC_REGIONS.map((r) => ({ value: r.id, label: r.label }))}
            onChange={changeRegion}
          />
          {/* NCR has no provinces, so its step disappears and cities list directly. */}
          {!ncr && (
            <Select
              id={`${id}-province`}
              label="Province"
              value={parts.province}
              placeholder={loading ? "Loading…" : "Select province"}
              disabled={!provinces}
              invalid={Boolean(error)}
              options={(provinces ?? []).map((p) => ({ value: p.name, label: p.name }))}
              onChange={(province) => commit({ ...parts, province, city: "", barangay: "" })}
            />
          )}
          <Select
            id={`${id}-city`}
            label="City / Municipality"
            value={parts.city}
            placeholder={ncr && loading ? "Loading…" : "Select city or municipality"}
            disabled={!provinces || (!ncr && !parts.province)}
            invalid={Boolean(error)}
            options={cities.map((c) => ({ value: c.name, label: c.name }))}
            onChange={(city) => commit({ ...parts, city, barangay: "" })}
          />
          <Select
            id={`${id}-barangay`}
            label="Barangay"
            value={parts.barangay}
            placeholder="Select barangay"
            disabled={!parts.city}
            invalid={Boolean(error)}
            options={barangays.map((b) => ({ value: b, label: b }))}
            onChange={(barangay) => commit({ ...parts, barangay })}
          />
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor={`${id}-street`} className="text-brand-muted text-xs font-semibold">
              House No. &amp; Street
            </label>
            <input
              id={`${id}-street`}
              type="text"
              autoComplete="off"
              value={parts.street}
              aria-invalid={Boolean(error)}
              onChange={(e) => commit({ ...parts, street: e.target.value })}
              className={`${CONTROL} ${error ? "border-red-500" : "border-brand-border/60"}`}
            />
          </div>
          {loadFailed === parts.regionId && (
            <p role="alert" className="text-xs text-red-600 sm:col-span-2">
              This region&apos;s address list could not be loaded.{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => load(parts.regionId)}
              >
                Try again
              </button>
            </p>
          )}
          {hasOriginal && (
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={cancelEditing}
                className="text-brand-maroon focus-visible:outline-brand-maroon rounded text-xs font-semibold underline underline-offset-2"
              >
                Keep current address
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p
            className={[
              "min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm break-words",
              disabled
                ? "border-brand-border/30 text-brand-muted bg-neutral-100"
                : "border-brand-border/30 text-brand-ink bg-neutral-50",
            ].join(" ")}
          >
            {value.trim() || <span className="text-brand-muted">Not provided</span>}
          </p>
          {!readOnly && !disabled && hasOriginal && (
            <button
              ref={editRef}
              type="button"
              aria-label={`Edit ${label}`}
              onClick={startEditing}
              className="border-brand-border/60 text-brand-ink hover:bg-brand-ink/5 focus-visible:outline-brand-maroon min-h-11 shrink-0 rounded-xl border px-4 text-sm font-semibold transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      )}

      {/* Reserved line so errors never shift layout */}
      <p
        id={errorId}
        role={error ? "alert" : undefined}
        className="min-h-[1.1rem] pt-1 text-xs text-red-600"
      >
        {error}
      </p>
    </div>
  );
}
