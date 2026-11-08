/// <reference types="node" />
// Runs in Node under Vitest; the rest of src/ is browser code.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// vercel.json's CSP allows index.html's inline theme script by its hash, so editing the
// script without updating the hash would block it on the live site.
test("the CSP allows index.html's inline script", () => {
  const html = readFileSync("index.html", "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  const hash = createHash("sha256").update(script).digest("base64");
  expect(readFileSync("vercel.json", "utf8")).toContain(`'sha256-${hash}'`);
});

// Google's sign-in (docs/specs/google-sign-in.md): its documented origins, and the referrer
// policy it recommends (other sites see only our origin, never a page's path).
test("the CSP lets Google's sign-in button load", () => {
  const { headers } = JSON.parse(readFileSync("vercel.json", "utf8"));
  const header = (key: string): string =>
    headers[0].headers.find((h: { key: string }) => h.key === key).value;
  const directive = (name: string) =>
    header("Content-Security-Policy")
      .split("; ")
      .find((d) => d.startsWith(`${name} `)) ?? "";
  expect(directive("script-src")).toContain(
    "https://accounts.google.com/gsi/client",
  );
  expect(directive("style-src")).toContain(
    "https://accounts.google.com/gsi/style",
  );
  expect(directive("frame-src")).toContain("https://accounts.google.com/gsi/");
  expect(directive("connect-src")).toContain(
    "https://accounts.google.com/gsi/",
  );
  expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
});
