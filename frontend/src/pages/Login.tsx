import { useEffect, useState, type SubmitEvent } from "react";
import { Link, useLocation } from "react-router";
import {
  ApiError,
  generalError,
  googleSignIn,
  logIn,
  signUp,
  tryDemo,
  type FieldErrors,
} from "../api";
import { clearNotice, saveSession, useAuth, type Session } from "../auth";
import { Field } from "../components/form";
import { Spinner, useSlow, WakingNote, Working } from "../components/Waiting";
import { GoogleButton, googleClientId } from "../google";
import { buttonPrimary, buttonSecondary, focusRing, input, link } from "../ui";
import { pageTitle } from "../site";

/** The ways in that wait on the server, each with its own spinner and words. */
type Way = "form" | "google" | "demo";

const MODES = {
  login: {
    title: "Log in",
    submit: "Log in",
    working: "Logging in…",
    password: "current-password",
    other: { text: "No account yet?", link: "Sign up", to: "/signup" },
  },
  signup: {
    title: "Sign up",
    submit: "Create account",
    working: "Creating account…",
    password: "new-password",
    other: { text: "Already have an account?", link: "Log in", to: "/login" },
  },
} as const;

/** Log in (`/login`) or sign up (`/signup`). Logged out, every other page sends you here. */
export function Login({ mode }: { mode: keyof typeof MODES }) {
  const { title, submit, working, password, other } = MODES[mode];
  // Why the last session ended, shown once: after that, / is the landing page again.
  const { notice: pending } = useAuth();
  const [notice] = useState(pending);
  useEffect(clearNotice, []);
  // The page that sent you here: kept when switching between log in and sign up, and
  // App goes back to it once the session is saved.
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const signingUp = mode === "signup";
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  // Which way in is waiting on the server: only that one spins and gets the waking note
  // (specs/waking-note.md). The pressed button stays at full strength; the others fade.
  const [saving, setSaving] = useState<Way | "">("");
  const slow = useSlow(saving !== "");

  // The form, Google and "Try the demo" all end in a session, with the same errors.
  async function start(way: Way, session: () => Promise<Session>, notice = "") {
    if (saving) return;
    setSaving(way);
    setErrors({});
    setError("");
    try {
      saveSession(await session(), notice);
    } catch (err) {
      const fieldErrors = err instanceof ApiError ? err.fieldErrors : {};
      setErrors(fieldErrors);
      setError(generalError(err, fieldErrors));
      setSaving("");
    }
  }

  function submitForm(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const username = form.username.trim();
    const email = form.email.trim();
    if (!signingUp)
      start("form", () => logIn({ username, password: form.password }));
    else
      start(
        "form",
        () => signUp({ username, email, password: form.password }),
        `We sent a link to ${email} to confirm your email. If it doesn’t arrive, check your spam folder.`,
      );
  }

  return (
    <main className="mx-auto max-w-[400px] px-4 pt-12 pb-10 sm:pt-20">
      <title>{pageTitle(title)}</title>
      <h1 className="font-serif text-[40px] leading-[44px] font-medium tracking-[-0.01em]">
        {title}
      </h1>
      <p className="mt-1.5 text-[13px] leading-[18px] text-muted">
        Track the parts, costs and profit of every PC you flip.
      </p>
      {notice && (
        <p
          role="status"
          className="mt-6 border-t border-line-strong pt-3 text-[15px] leading-[22px]"
        >
          {notice}
        </p>
      )}

      <form
        noValidate
        onSubmit={submitForm}
        className="mt-8 flex flex-col gap-4"
      >
        <Field label="Username" errors={errors.username}>
          <input
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={150}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            aria-invalid={!!errors.username}
            className={input(!!errors.username)}
          />
        </Field>
        {signingUp && (
          <Field label="Email" errors={errors.email}>
            <input
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              aria-invalid={!!errors.email}
              className={input(!!errors.email)}
            />
          </Field>
        )}
        <Field label="Password" errors={errors.password}>
          <input
            type="password"
            autoComplete={password}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            aria-invalid={!!errors.password}
            className={input(!!errors.password)}
          />
        </Field>
        {error && (
          <p role="alert" className="text-[13px] leading-[18px] text-loss">
            {error}
          </p>
        )}
        <button
          type="submit"
          aria-disabled={saving === "form" || undefined}
          // While it works, only another way in disables it; a cleared field doesn't.
          disabled={
            saving
              ? saving !== "form"
              : !form.username.trim() ||
                !form.password ||
                (signingUp && !form.email.trim())
          }
          className={`mt-2 ${buttonPrimary}`}
        >
          {saving === "form" ? <Working>{working}</Working> : submit}
        </button>
        {slow && saving === "form" && <WakingNote />}
      </form>
      {!signingUp && (
        <p className="mt-4">
          <Link to="/forgot" className={link}>
            Forgot your username or password?
          </Link>
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-6">
        {googleClientId() && (
          <GoogleButton
            onCredential={(credential) =>
              start("google", () => googleSignIn(credential))
            }
            onError={() =>
              setError(
                "Couldn’t load Google sign-in. Check your connection, or use your username and password.",
              )
            }
          />
        )}
        {saving === "google" && (
          <p
            role="status"
            className="flex items-center gap-2 text-[13px] leading-[18px] text-muted"
          >
            <Spinner />
            Signing in with Google…
          </p>
        )}
        <button
          type="button"
          onClick={() => start("demo", tryDemo)}
          aria-disabled={saving === "demo" || undefined}
          disabled={saving !== "" && saving !== "demo"}
          className={`w-full ${buttonSecondary}`}
        >
          {saving === "demo" ? (
            <Working>Starting the demo…</Working>
          ) : (
            "Try the demo"
          )}
        </button>
        <p className="-mt-1 text-[13px] leading-[18px] text-muted">
          A sample account with two builds to change freely. It’s deleted after
          24 hours.
        </p>
        {slow && saving !== "form" && <WakingNote />}
      </div>

      <p className="mt-6 text-[13px] leading-[18px] text-muted">
        {other.text}{" "}
        <Link
          to={other.to}
          state={{ from }}
          className={`rounded font-medium text-accent hover:underline ${focusRing}`}
        >
          {other.link}
        </Link>
      </p>
    </main>
  );
}
