/// <reference types="node" />
// Runs in Node under Vitest: vercel.json and App.tsx as files (docs/specs/landing-page.md).
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));

// Vercel's sources are path patterns: ":id" is one segment, "(…)" a regex group.
const matches = (source: string, path: string) =>
  new RegExp(`^${source.replace(/:\w+/g, "[^/]+")}$`).test(path);

const rewritten = (path: string) =>
  vercel.rewrites.some(({ source }: { source: string }) =>
    matches(source, path),
  );

// Only the app's own routes get index.html; anything else is a real 404, so Google doesn't
// count made-up URLs as pages (soft 404s).
test("every route in App.tsx is rewritten to the app, and nothing else is", () => {
  const routes = [
    ...readFileSync("src/App.tsx", "utf8").matchAll(/path="([^"]+)"/g),
  ]
    .map((m) => m[1])
    .filter((p) => p !== "*");
  expect(routes.length).toBeGreaterThan(5);
  for (const route of routes)
    expect(rewritten(route.replace(/:\w+/g, "abc")), route).toBe(true);
  for (const path of ["/anything", "/sitemap", "/builds", "/builds/a/b"])
    expect(rewritten(path), path).toBe(false);
});

const robots = (path: string): string[] =>
  vercel.headers
    .filter(({ source }: { source: string }) => matches(source, path))
    .flatMap(({ headers }: { headers: { key: string; value: string }[] }) =>
      headers.filter((h) => h.key === "X-Robots-Tag").map((h) => h.value),
    );

test("private pages ask not to be indexed; the home page and Privacy don't", () => {
  for (const path of [
    "/login",
    "/signup",
    "/account",
    "/forgot",
    "/reset-password",
    "/verify-email",
    "/builds/abc",
  ])
    expect(robots(path), path).toEqual(["noindex"]);
  for (const path of ["/", "/privacy", "/sitemap.xml"])
    expect(robots(path), path).toEqual([]);
});
