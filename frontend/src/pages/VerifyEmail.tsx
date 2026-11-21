import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ApiError, confirmEmail, generalError } from "../api";
import { Bone, Skeleton } from "../components/Skeleton";
import { link } from "../ui";

type Result =
  | { kind: "loading" }
  | { kind: "confirmed"; email: string }
  | { kind: "gone" }
  | { kind: "failed"; message: string };

/** Opened from the emailed link (`/verify-email?token=…`), logged in or out: confirms the
 * email on load. */
export function VerifyEmail() {
  const token = useSearchParams()[0].get("token") ?? "";
  const [result, setResult] = useState<Result>(
    token ? { kind: "loading" } : { kind: "gone" },
  );
  // Once: a link works only once, and StrictMode runs effects twice in development.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    confirmEmail(token).then(
      ({ email }) => setResult({ kind: "confirmed", email }),
      (err) => {
        const errors = err instanceof ApiError ? err.fieldErrors : {};
        setResult(
          errors.token
            ? { kind: "gone" }
            : {
                kind: "failed",
                message:
                  Object.values(errors).flat().join(" ") ||
                  generalError(err, {}),
              },
        );
      },
    );
  }, [token]);

  const title = {
    loading: "",
    confirmed: "Email confirmed",
    gone: "This link no longer works",
    failed: "Couldn’t confirm your email",
  }[result.kind];

  return (
    <main className="mx-auto max-w-[400px] px-4 pt-12 pb-10 text-[15px] leading-[22px] sm:pt-20">
      <title>Verify email · PC Flipper Toolkit</title>
      {result.kind === "loading" ? (
        <Skeleton label="Confirming your email">
          <Bone className="h-11 w-full" />
          <Bone className="mt-6 h-[22px] w-3/4" />
        </Skeleton>
      ) : (
        <>
          <h1 className="font-serif text-[40px] leading-[44px] font-medium tracking-[-0.01em]">
            {title}
          </h1>
          <p className="mt-6">
            {result.kind === "confirmed" && (
              <>
                <span className="font-medium break-words">{result.email}</span>{" "}
                is on your account now.
              </>
            )}
            {result.kind === "gone" &&
              "Confirmation links work once, for 24 hours. Add your email again on Account to get a new one."}
            {result.kind === "failed" && result.message}
          </p>
          <p className="mt-4">
            {/* Logged out, Account asks to log in first, then opens. */}
            <Link to="/account" className={link}>
              Go to Account
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
