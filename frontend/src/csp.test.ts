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
