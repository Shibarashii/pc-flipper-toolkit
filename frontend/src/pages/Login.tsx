import { useState, type SubmitEvent } from "react";
import { Link, useLocation } from "react-router";
import { ApiError, logIn, signUp, type FieldErrors } from "../api";
import { saveSession, useAuth } from "../auth";
import { Field } from "../components/form";
import { buttonPrimary, input } from "../ui";

const MODES = {
  login: {
    title: "Log in",
    submit: "Log in",
    request: logIn,
    password: "current-password",
    other: { text: "No account yet?", link: "Sign up", to: "/signup" },
  },
  signup: {
    title: "Sign up",
    submit: "Create account",
    request: signUp,
    password: "new-password",
    other: { text: "Already have an account?", link: "Log in", to: "/login" },
  },
} as const;

/** What went wrong, for anything that isn't a message under a field. */
function generalError(err: unknown, errors: FieldErrors): string {
  if (err instanceof ApiError && err.status === 429)
    return "Too many attempts. Wait a minute and try again.";
  if (errors.non_field_errors) return errors.non_field_errors.join(" ");
  if (Object.keys(errors).length > 0) return "";
  return "Couldn’t reach the server. Check your connection and try again.";
}

/** Log in (`/login`) or sign up (`/signup`). Logged out, every other page sends you here. */
export function Login({ mode }: { mode: keyof typeof MODES }) {
  const { title, submit, request, password, other } = MODES[mode];
  const { notice } = useAuth();
  // The page that sent you here: kept when switching between log in and sign up, and
  // App goes back to it once the session is saved.
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const [form, setForm] = useState({ username: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitForm(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setError("");
    try {
      saveSession(await request({ ...form, username: form.username.trim() }));
    } catch (err) {
      const fieldErrors = err instanceof ApiError ? err.fieldErrors : {};
      setErrors(fieldErrors);
      setError(generalError(err, fieldErrors));
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-[400px] px-4 pt-12 pb-10 sm:pt-20">
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
          disabled={saving || !form.username.trim() || !form.password}
          className={`mt-2 ${buttonPrimary}`}
        >
          {submit}
        </button>
      </form>

      <p className="mt-6 text-[13px] leading-[18px] text-muted">
        {other.text}{" "}
        <Link
          to={other.to}
          state={{ from }}
          className="font-medium text-accent hover:underline"
        >
          {other.link}
        </Link>
      </p>
    </main>
  );
}
