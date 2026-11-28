import { useId, useRef, useState } from "react";

import { gradeField } from "./gradeStyles";
import { gradeMarkLabel, type GradePolicy } from "./gradingMode";

export function GradeMarkInput({
  policy,
  studentName,
  studentNumber,
  value,
  error,
  errorId,
  readOnly,
  fieldRef,
  onChange,
}: {
  policy: GradePolicy;
  studentName: string;
  studentNumber: string;
  value: string;
  error: boolean;
  errorId: string;
  readOnly: boolean;
  fieldRef: (element: HTMLInputElement | HTMLSelectElement | null) => void;
  onChange: (value: string) => void;
}) {
  const shared = {
    "aria-label": `Grade for ${studentName} (${studentNumber})`,
    "aria-invalid": error,
    "aria-describedby": `grade-mark-help${error ? " " + errorId : ""}`,
    value,
    className: gradeField + (error ? " border-red-700!" : ""),
  };
  if (policy.mode === "PASS_FAIL")
    return (
      <select
        {...shared}
        ref={fieldRef}
        disabled={readOnly}
        className={shared.className + " cursor-pointer disabled:cursor-not-allowed"}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select mark</option>
        {policy.allowedMarks.map((mark) => (
          <option key={mark} value={mark}>
            {gradeMarkLabel(mark)}
          </option>
        ))}
      </select>
    );
  return (
    <MarkCombobox
      shared={shared}
      studentName={studentName}
      marks={policy.allowedMarks}
      readOnly={readOnly}
      fieldRef={fieldRef}
      onChange={onChange}
    />
  );
}

/**
 * A text field with its own list of allowed marks. Opening the list always shows every mark
 * (the current one highlighted); only text typed after opening narrows it, so an entered grade
 * can be changed by picking another without clearing the field first.
 */
function MarkCombobox({
  shared,
  studentName,
  marks,
  readOnly,
  fieldRef,
  onChange,
}: {
  shared: {
    "aria-label": string;
    "aria-invalid": boolean;
    "aria-describedby": string;
    value: string;
    className: string;
  };
  studentName: string;
  marks: readonly string[];
  readOnly: boolean;
  fieldRef: (element: HTMLInputElement | null) => void;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);
  const query = shared.value.trim().toUpperCase();
  const filtered = typed && query ? marks.filter((mark) => mark.startsWith(query)) : marks;
  const options = filtered.length ? filtered : marks;

  function show() {
    if (readOnly) return;
    setTyped(false);
    setActive(marks.indexOf(query));
    setOpen(true);
  }
  function choose(mark: string) {
    onChange(mark);
    setOpen(false);
    setTyped(false);
  }

  return (
    <div className="relative">
      <input
        {...shared}
        ref={(element) => {
          input.current = element;
          fieldRef(element);
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        readOnly={readOnly}
        autoComplete="off"
        className={shared.className + " pr-9 read-only:cursor-not-allowed"}
        onClick={() => {
          if (!open) show();
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          onChange(event.target.value);
          setTyped(true);
          setActive(0);
          if (!readOnly) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) return show();
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((index) => (index + step + options.length) % options.length);
          } else if (event.key === "Enter" && open && active >= 0 && options[active]) {
            event.preventDefault();
            choose(options[active]);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Show allowed marks for ${studentName}`}
        disabled={readOnly}
        className="text-brand-muted absolute inset-y-0 right-0 grid w-9 cursor-pointer place-items-center disabled:cursor-not-allowed"
        onMouseDown={(event) => {
          event.preventDefault();
          if (open) setOpen(false);
          else {
            input.current?.focus();
            show();
          }
        }}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="size-4">
          <path d="M5.5 7.5 10 12l4.5-4.5z" />
        </svg>
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Allowed marks"
          className="border-brand-border/40 absolute left-0 z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-white py-1 text-sm shadow-lg"
        >
          {options.map((mark, index) => (
            <li
              key={mark}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={mark === query}
              className={`cursor-pointer px-3 py-2 ${
                index === active ? "bg-brand-maroon text-white" : "hover:bg-brand-paper"
              } ${mark === query ? "font-semibold" : ""}`}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(mark);
              }}
              onMouseEnter={() => setActive(index)}
            >
              {mark}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
