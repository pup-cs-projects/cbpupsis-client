/**
 * The look of the sign-in screen, written once so the student, faculty, admin, and superadmin
 * pages cannot drift apart. They are Tailwind utilities laid over the shared auth.css; `!` makes
 * them win over its rules. Tailwind finds the class names here because this package is a
 * `@source` of every app.
 */

// A control flagged by aria-invalid gets a maroon outline; `!` beats the shared auth.css border.
const FLAGGED = "aria-invalid:border-brand-maroon!";
const GLOW = "[text-shadow:0_1px_3px_rgb(255_255_255/0.4)]";

export const signInStyles = {
  title: "font-bold!",
  subtitle:
    "auth-subtitle text-brand-maroon! font-semibold! [text-shadow:0_1px_2px_rgb(255_255_255/0.55)]",
  label: "text-sm! font-semibold! text-white! drop-shadow-sm",
  input: `${FLAGGED} text-sm! font-normal! text-brand-ink!`,
  select: `${FLAGGED} text-sm! font-normal! max-lg:pr-8! max-lg:pl-3!`,
  /** The password group sits snug against the submit area, so it drops its bottom margin. */
  passwordGroup: "mb-0!",
  forgotPassword: `forgot-password text-brand-maroon! mt-0! min-h-8! px-0! text-xs! font-semibold! ${GLOW} hover:underline`,
  /** Wraps the one-line message above the button and the button itself. */
  submitArea: "flex flex-col gap-3",
  submitStack: "flex flex-col gap-1",
  /** Always one line tall, so showing the message never moves anything. */
  messageLine: "flex min-h-6 items-center justify-center",
  message:
    "border-brand-maroon/40 bg-brand-maroon-dark/80 rounded-full border px-3 text-xs leading-5 font-medium text-white",
  help: "account-help text-xs! font-normal! text-white/90! drop-shadow-sm",
  helpLink: `text-brand-maroon! font-semibold! ${GLOW}`,
} as const;

const SUBMIT = "primary-button h-[52px]! min-h-[52px]! text-sm! font-semibold! text-white!";

/** The "Sign in to Portal" button: the busy state adds the shared `.is-busy` progress line. */
export function submitButtonClass(busy: boolean) {
  return busy ? `${SUBMIT} is-busy` : SUBMIT;
}
