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
