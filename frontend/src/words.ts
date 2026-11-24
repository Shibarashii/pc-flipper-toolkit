/** Builds are labeled by their number (1, 2, 3… per user), zero-padded: 1 → "01". */
export const buildNo = (number: number) => String(number).padStart(2, "0");
