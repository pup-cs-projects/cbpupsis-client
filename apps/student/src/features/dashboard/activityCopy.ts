// Recent Activity is written for the student, never for a log reader: no error codes, no event
// keys. The API's text sometimes carries them ("Login attempt failed. AUTH_FAILED", "Action
// emergency_contact.created completed."), so every item passes through here before it is shown.

/** How a past-tense action reads to a student: "created" is "added", "deleted" is "removed". */
const VERBS: Record<string, string> = {
  created: "added",
  added: "added",
  updated: "updated",
  changed: "changed",
  deleted: "removed",
  removed: "removed",
  submitted: "submitted",
  approved: "approved",
  rejected: "rejected",
  cancelled: "cancelled",
  canceled: "cancelled",
  confirmed: "confirmed",
  verified: "verified",
  uploaded: "uploaded",
  downloaded: "downloaded",
  generated: "generated",
  requested: "requested",
  completed: "completed",
  dropped: "dropped",
  saved: "saved",
  revoked: "revoked",
  reset: "reset",
};

/** What a type says on its own, for an item whose text had nothing readable left. */
const TYPE_COPY: Record<string, string> = {
  LOGIN_SUCCESS: "Signed in successfully.",
  LOGOUT: "Signed out.",
  PASSWORD_CHANGED: "Password changed successfully.",
  PASSWORD_RESET: "Password reset.",
};

// "AUTH_FAILED", "AUTH_INVALID_CREDENTIALS": error codes. They say nothing to a student.
const ERROR_CODE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;
// "emergency_contact.created", "profile_photo": event keys and field names.
const SNAKE_OR_DOT_KEY = /\b[a-z][a-z0-9]*(?:[._][a-z0-9]+)+\b/g;
// "Action emergency_contact.created completed."
const ACTION_SENTENCE = /^\s*action\s+(\S+?)\s+completed\.?\s*$/i;
const SIGN_IN_FAILURE_CODE = /\bAUTH_[A-Z0-9_]+\b/;
const SIGN_IN_FAILURE_TYPE = /^(LOGIN|SIGN_?IN|AUTH)(_\w+)?_(FAILED|FAILURE|INVALID\w*)$/;

const SIGN_IN_FAILED = "Sign-in attempt failed";

function sentence(words: string) {
  const text = words.trim().replace(/\s+/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function words(key: string) {
  return key
    .replace(/[._-]+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * "emergency_contact.created" → "Emergency contact added."; "payment.submitted" → "Payment
 * submitted."; a key with no known verb is spelled out ("foo_bar.baz" → "Foo bar baz.").
 */
export function humanizeKey(key: string): string {
  const parts = key.split(".");
  const last = parts[parts.length - 1] ?? "";
  const verb = VERBS[last.toLowerCase()];
  const text =
    verb && parts.length > 1 ? `${words(parts.slice(0, -1).join(" "))} ${verb}` : words(key);
  return `${sentence(text)}.`;
}

/** An inline key (a field or event name inside a longer sentence) read as plain words. */
function readableKey(match: string) {
  const last = match.split(".").pop() ?? "";
  // A bare "report.pdf" or "e.g" is not a key; only underscores or a known verb make it one.
  if (!match.includes("_") && !VERBS[last.toLowerCase()]) return match;
  return words(match);
}

/** The text a student sees for one activity item. */
export function humanizeActivity(item: { type: string; description: string }): string {
  const { type, description } = item;

  if (SIGN_IN_FAILURE_CODE.test(description) || SIGN_IN_FAILURE_TYPE.test(type)) {
    return SIGN_IN_FAILED;
  }

  const action = ACTION_SENTENCE.exec(description);
  if (action?.[1]) return humanizeKey(action[1]);

  const cleaned = description
    .replace(ERROR_CODE, "")
    .replace(SNAKE_OR_DOT_KEY, readableKey)
    // What stripping a code can leave behind: a doubled space, a dangling ": " or " .".
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/[:;,\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/[A-Za-z]/.test(cleaned)) return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;

  return TYPE_COPY[type] ?? (type ? humanizeKey(type.toLowerCase()) : "Account activity.");
}
