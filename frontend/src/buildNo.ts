/** Builds are labeled by id, zero-padded to 2 digits: 1 → "01". */
export const buildNo = (id: number) => String(id).padStart(2, "0");
