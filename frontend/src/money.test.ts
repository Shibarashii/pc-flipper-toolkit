import { expect, test } from "vitest";
import { formatMoney, formatSignedMoney } from "./money";

test("formats PHP with grouping and centavos", () => {
  expect(formatMoney("12500.00")).toBe("₱12,500.00");
  expect(formatMoney("0.00")).toBe("₱0.00");
});

test("null renders as a dash", () => {
  expect(formatMoney(null)).toBe("—");
  expect(formatSignedMoney(null)).toBe("—");
});

test("signed money uses + and a true minus", () => {
  expect(formatSignedMoney("3700.00")).toBe("+₱3,700.00");
  expect(formatSignedMoney("-1300.00")).toBe("−₱1,300.00");
});
