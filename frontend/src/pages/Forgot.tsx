import { useState, type SubmitEvent } from "react";
import { Link } from "react-router";
import { askForResetLink, generalError } from "../api";
import { Field, focusOnMount, useSave } from "../components/form";
import { buttonPrimary, input, link } from "../ui";
import { pageTitle } from "../site";

/** `/forgot`, logged in or out: emails the username and a reset link. The same message
 * whether or not an account has the email. */
export function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { errors, error, failed, saving, save } = useSave({ email: "" });

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    void save(async () => {
      await askForResetLink(email.trim());
      setSent(true);
    });
  }

  return (
    <main className="mx-auto max-w-[400px] px-4 pt-12 pb-10 text-[15px] leading-[22px] sm:pt-20">
      <title>{pageTitle("Forgot password")}</title>
      <h1 className="font-serif text-[40px] leading-[44px] font-medium tracking-[-0.01em]">
        Forgot your username or password?
      </h1>
      {sent ? (
        <p
          role="status"
          ref={focusOnMount}
          tabIndex={-1}
          className="mt-6 outline-none"
        >
          <span className="font-medium">
            If an account has that email, we’ve sent it a link.
          </span>{" "}
          It works for 1 hour. If it doesn’t arrive, check your spam folder.
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-[13px] leading-[18px] text-muted">
            Type your account’s email. We’ll send your username and a link to
            set a new password.
          </p>
          <form
            noValidate
            onSubmit={submit}
            className="mt-8 flex flex-col gap-4"
          >
            <Field label="Email" errors={errors.email}>
              <input
                type="email"
                autoFocus
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                className={input(!!errors.email)}
              />
            </Field>
            {failed && (
              <p role="alert" className="text-[13px] leading-[18px] text-loss">
                {generalError(error, {})}
              </p>
            )}
            <button
              type="submit"
              disabled={saving || !email.trim()}
              className={buttonPrimary}
            >
              Send link
            </button>
          </form>
        </>
      )}
      <p className="mt-4">
        <Link to="/login" className={link}>
          Back to log in
        </Link>
      </p>
    </main>
  );
}
