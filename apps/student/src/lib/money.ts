// Money is formatted once, here, as Philippine pesos (docs/CONVENTIONS.md). Never do money math
// in the client; this only displays the amount the API already computed.

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export function formatPeso(amount: number): string {
  return peso.format(amount);
}

// The billing screens hold amounts as the decimal strings the API sent. Intl reads a decimal
// string exactly (no float in between), so "2045.5" shows as ₱2,045.50 with no arithmetic.
const pesoExact = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "2045.00" as "₱2,045.00": the API's text, grouped and padded to two decimals. */
export function formatPesoAmount(amount: string): string {
  return pesoExact.format(amount as `${number}`);
}

/** True when the amount has no non-zero digit ("0", "0.00"). A text check, not arithmetic. */
export function isZeroAmount(amount: string): boolean {
  return !/[1-9]/.test(amount);
}

/** True when the amount is above zero. A text check, not arithmetic. */
export function isPositiveAmount(amount: string): boolean {
  return !amount.startsWith("-") && !isZeroAmount(amount);
}
