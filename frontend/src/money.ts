const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

/** "12500.00" → "₱12,500.00"; null → "—". The API sends money as strings. */
export function formatMoney(value: string | null): string {
  return value === null ? "—" : peso.format(Number(value));
}

/** Always signed, with a true minus: "+₱3,700.00" / "−₱1,300.00". */
export function formatSignedMoney(value: string | null): string {
  if (value === null) return "—";
  const n = Number(value);
  return (n < 0 ? "−" : "+") + peso.format(Math.abs(n));
}
