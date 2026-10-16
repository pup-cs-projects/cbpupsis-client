import { useState, type ChangeEvent, type FocusEvent } from "react";

/**
 * One text field's value and its client-side check.
 *
 * The check first runs when the person leaves a field they typed in, or on submit; from then
 * on it reruns on every keystroke, so an error clears the moment it is fixed. Feedback only:
 * the API validates again.
 */
export function useCheckedField(validate: (value: string) => string | undefined) {
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  return {
    value,
    error: checked ? validate(value) : undefined,
    /** On submit: show the problem, if any, and return it. */
    check() {
      setChecked(true);
      return validate(value);
    },
    /** Empty the field, as after a refused password. */
    clear() {
      setValue("");
      setChecked(false);
    },
    onChange(event: ChangeEvent<HTMLInputElement>) {
      setValue(event.target.value);
    },
    // Reads the input, not state: a field emptied in the same event would otherwise look typed in.
    onBlur(event: FocusEvent<HTMLInputElement>) {
      if (event.target.value !== "") setChecked(true);
    },
  };
}
