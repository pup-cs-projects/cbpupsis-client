/** Accepts +63 9XX XXX XXXX (international) or 09XX XXX XXXX (local); strips spaces/dashes. */
export function isValidPHPhone(raw: string): boolean {
  const n = raw.replace(/[\s\-().]/g, "");
  return /^(\+639\d{9}|09\d{9})$/.test(n);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function isValidAddress(value: string): boolean {
  return value.trim().length >= 10;
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/** The API takes +639XXXXXXXXX or 09XXXXXXXXX only; the form also allows spaces and dashes. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, "");
}

/** `+63 912 345 6789` and `0912-345-6789` are the same number; compare them in one shape. */
function phoneKey(raw: string): string {
  const n = normalizePhone(raw);
  return n.startsWith("+63") ? `0${n.slice(3)}` : n;
}

/** Case, spacing, and diacritics never make two names different people. */
function nameKey(raw: string): string {
  return raw.normalize("NFD").replace(/\p{M}/gu, "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** True when two contacts have the same normalized name and phone number. */
export function isSameContact(
  a: { name: string; phone: string },
  b: { name: string; phone: string },
): boolean {
  return nameKey(a.name) === nameKey(b.name) && phoneKey(a.phone) === phoneKey(b.phone);
}
