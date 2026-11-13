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
  return policy.mode === "PASS_FAIL" ? (
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
  ) : (
    <input
      {...shared}
      ref={fieldRef}
      readOnly={readOnly}
      autoComplete="off"
      list="grade-values"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
