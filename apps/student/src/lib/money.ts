// Money is formatted once, here, as Philippine pesos (docs/CONVENTIONS.md). Never do money math
// in the client; this only displays the amount the API already computed.

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

export function formatPeso(amount: number): string {
  return peso.format(amount);
}
