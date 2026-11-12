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

// A shared link's card and the search snippet (docs/specs/share-card.md). Link previewers
// don't run JavaScript, so the tags must be in index.html itself, with absolute URLs.
test("index.html has the share card's tags and its 1200×630 image", () => {
  const html = readFileSync("index.html", "utf8");
  const meta = (attr: string, name: string): string =>
    html.match(
      new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`),
    )?.[1] ?? "";
  const site = "https://pc-flipper-toolkit.vercel.app/";
  const line = meta("name", "description");
  expect(line.length).toBeGreaterThan(0);
  expect(line.length).toBeLessThan(155);
  expect(line).toMatch(/Try the demo, no sign-up needed\.$/);
  expect(meta("property", "og:description")).toBe(line);
  expect(meta("property", "og:title")).toBe("PC Flipper Toolkit");
  expect(meta("property", "og:type")).toBe("website");
  expect(meta("property", "og:url")).toBe(site);
  expect(html).toContain(`<link rel="canonical" href="${site}" />`);
  expect(meta("property", "og:image")).toBe(`${site}og-image.png`);
  expect(meta("property", "og:image:alt")).not.toBe("");
  // A PNG's width and height are big-endian at bytes 16 and 20.
  const png = readFileSync("public/og-image.png");
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  expect(meta("property", "og:image:width")).toBe("1200");
  expect(meta("property", "og:image:height")).toBe("630");
  expect(png.length).toBeLessThan(1024 * 1024);
});
