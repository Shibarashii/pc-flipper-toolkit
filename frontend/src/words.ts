/** Builds are labeled by their number (1, 2, 3… per user), zero-padded: 1 → "01". */
export const buildNo = (number: number) => String(number).padStart(2, "0");

/** "1 part", "3 parts": `many` defaults to `one` + "s". */
export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
