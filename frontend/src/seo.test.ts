/// <reference types="node" />
// Runs in Node under Vitest: vercel.json and App.tsx as files (docs/specs/landing-page.md).
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { SITE_URL } from "./site";

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

// The rewrites match exact paths, so "/login/" would 404. Vercel redirects it to "/login"
// instead, which also leaves Google one address per page.
test("a trailing slash redirects to the page instead of a 404", () => {
  expect(vercel.trailingSlash).toBe(false);
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

// Each page that wants a canonical renders its own (Privacy for now); a static one in
// index.html would tell Google every route is the home page.
test("index.html has no canonical of its own", () => {
  expect(readFileSync("index.html", "utf8")).not.toContain('rel="canonical"');
});

// The static files can't import SITE_URL, so this lists any of our URLs they spell otherwise.
// Third-party hosts (fonts, Google sign-in, schema.org, the sitemap's namespace) are left out.
const THIRD_PARTY =
  /^https?:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|accounts\.google\.com|schema\.org|www\.sitemaps\.org)(\/|$)/;

test("every absolute URL of ours in the static files is SITE_URL's", () => {
  for (const file of [
    "index.html",
    "public/sitemap.xml",
    "public/robots.txt",
  ]) {
    const urls = [
      ...readFileSync(file, "utf8").matchAll(/https?:\/\/[^\s"'<>]+/g),
    ]
      .map((m) => m[0])
      .filter((url) => !THIRD_PARTY.test(url));
    expect(urls.length, file).toBeGreaterThan(0);
    for (const url of urls)
      expect(url.startsWith(`${SITE_URL}/`), `${file}: ${url}`).toBe(true);
  }
});

test("the sitemap lists the home page and Privacy, and robots.txt points to it", () => {
  const locs = [
    ...readFileSync("public/sitemap.xml", "utf8").matchAll(
      /<loc>([^<]+)<\/loc>/g,
    ),
  ].map((m) => m[1]);
  expect(locs).toEqual([`${SITE_URL}/`, `${SITE_URL}/privacy`]);
  expect(readFileSync("public/robots.txt", "utf8")).toContain(
    `Sitemap: ${SITE_URL}/sitemap.xml`,
  );
});

// Google takes the site's name in results from this (docs/specs/landing-page.md).
test("index.html names the site in WebSite structured data", () => {
  const json = readFileSync("index.html", "utf8").match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  expect(JSON.parse(json![1])).toEqual({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PC Flipper Toolkit",
    url: `${SITE_URL}/`,
  });
});
