import { useState, type SubmitEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { ApiError, generalError, resetPassword } from "../api";
import { Field, focusOnMount, useSave } from "../components/form";
import { buttonPrimary, input } from "../ui";

const heading =
  "font-serif text-[40px] leading-[44px] font-medium tracking-[-0.01em] outline-none";

/** `/reset-password?uid=…&token=…`, opened from the emailed link, logged in or out. A
 * new password; it doesn't log in. */
export function ResetPassword() {
  const [params] = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<"form" | "done" | "gone">(
    uid && token ? "form" : "gone",
  );
  const { errors, error, failed, saving, save } = useSave({
    new_password: "",
  });

  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    void save(async () => {
      try {
        await resetPassword({ uid, token, new_password: password });
      } catch (err) {
        if (err instanceof ApiError && err.fieldErrors.token) setResult("gone");
        throw err;
      }
      setResult("done");
    });
  }

  return (
    <main className="mx-auto max-w-[400px] px-4 pt-12 pb-10 text-[15px] leading-[22px] sm:pt-20">
      <title>Reset password · PC Flipper Toolkit</title>
      {result === "form" && (
        <>
          <h1 className={heading}>Set a new password</h1>
          <form
            noValidate
            onSubmit={submit}
            className="mt-8 flex flex-col gap-4"
          >
            <Field label="New password" errors={errors.new_password}>
              <input
                type="password"
                autoFocus
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.new_password}
                className={input(!!errors.new_password)}
              />
            </Field>
            {failed && (
              <p role="alert" className="text-[13px] leading-[18px] text-loss">
                {generalError(error, {})}
              </p>
            )}
            <button
              type="submit"
              disabled={saving || !password}
              className={buttonPrimary}
            >
              Set password
            </button>
          </form>
        </>
      )}
      {result === "done" && (
        <>
          <h1 ref={focusOnMount} tabIndex={-1} className={heading}>
            Password changed
          </h1>
          <p className="mt-6">Log in with your new password.</p>
          <Link
            to="/login"
            className={`mt-4 block text-center ${buttonPrimary}`}
          >
            Log in
          </Link>
        </>
      )}
      {result === "gone" && (
        <>
          <h1 ref={focusOnMount} tabIndex={-1} className={heading}>
            This link no longer works
          </h1>
          <p className="mt-6">
            Reset links work once, for 1 hour. Ask for a new one.
          </p>
          <Link
            to="/forgot"
            className={`mt-4 block text-center ${buttonPrimary}`}
          >
            Get a new link
          </Link>
        </>
      )}
    </main>
  );
}
