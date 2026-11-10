import type { ReactNode } from "react";
import { focusRing } from "../ui";

const CONTACT = "pcflippertoolkit@gmail.com";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 border-t border-line-strong pt-4 sm:mt-12">
      <h2 className="font-serif text-[22px] leading-7 font-medium">{title}</h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

/** What the app keeps and who sees it (`/privacy`), for anyone, logged in or not. Google
 * needs its URL to publish sign-in with Google. */
export function Privacy() {
  return (
    <main className="mx-auto max-w-[640px] px-4 pt-12 pb-16 text-[15px] leading-[22px] sm:pt-20">
      <h1 className="font-serif text-[40px] leading-[44px] font-medium tracking-[-0.01em]">
        Privacy
      </h1>
      <p className="mt-1.5 text-[13px] leading-[18px] text-muted">
        Last updated 10 November 2026
      </p>

      <Section title="What the app keeps">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            Your username and, if you set one, your password, stored only as a
            salted hash.
          </li>
          <li>
            If you sign in with Google: your Google account’s email and its id,
            so the same Google account always opens the same account here.
            Nothing else from Google: not your name, photo or contacts.
          </li>
          <li>Your builds: the parts, prices, costs and notes you enter.</li>
          <li>
            In your browser: your log-in token and whether you chose light or
            dark.
          </li>
        </ul>
      </Section>

      <Section title="Who else sees it">
        <p>
          Nobody. Nothing is sold or shared, and there are no ads or trackers.
        </p>
        <p>
          The site runs on Vercel, the server on Render and the database on
          Neon, which store it on the app’s behalf and, like any website, keep
          short-lived request logs such as IP addresses. The fonts load from
          Google Fonts, and signing in with Google goes through Google.
        </p>
      </Section>

      <Section title="Demo accounts">
        <p>
          A demo account stops working after 24 hours, and it and its builds are
          deleted soon after.
        </p>
      </Section>

      <Section title="Deleting your account">
        <p>
          Email{" "}
          <a
            href={`mailto:${CONTACT}`}
            className={`rounded font-medium text-accent hover:underline ${focusRing}`}
          >
            {CONTACT}
          </a>{" "}
          with your username, and the account and all its builds are deleted.
        </p>
      </Section>
    </main>
  );
}
