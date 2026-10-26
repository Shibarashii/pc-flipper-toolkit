import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError, getBuild, type Build } from "../api";
import { StatusTag } from "../components/StatusTag";
import { buildNo } from "../buildNo";

type Result =
  { kind: "error" } | { kind: "not-found" } | { kind: "ok"; build: Build };

export function BuildDetail() {
  const id = Number(useParams().id);
  const validId = Number.isInteger(id) && id > 0;
  // Tagged with the id it belongs to, so navigating to another build shows "loading".
  const [result, setResult] = useState<{ id: number; result: Result } | null>(
    null,
  );

  useEffect(() => {
    if (!validId) return;
    let ignore = false;
    getBuild(id).then(
      (build) => !ignore && setResult({ id, result: { kind: "ok", build } }),
      (e) =>
        !ignore &&
        setResult({
          id,
          result: {
            kind:
              e instanceof ApiError && e.status === 404 ? "not-found" : "error",
          },
        }),
    );
    return () => {
      ignore = true;
    };
  }, [id, validId]);

  const state: Result | { kind: "loading" } = !validId
    ? { kind: "not-found" }
    : result?.id === id
      ? result.result
      : { kind: "loading" };

  return (
    <main className="mx-auto max-w-5xl px-4 pt-7 pb-10 sm:px-8 sm:pt-12">
      <Link
        to="/"
        className="text-[13px] font-medium text-muted hover:text-ink"
      >
        ← Builds
      </Link>

      {state.kind === "loading" && (
        <p className="mt-4 text-[13px] text-muted">Loading…</p>
      )}

      {state.kind === "not-found" && (
        <div className="mt-8 border-t border-line-strong py-20 text-center">
          <h1 className="font-serif text-[22px] font-medium">
            Build not found
          </h1>
          <p className="mt-1 text-muted">
            It may have been deleted. Go back to your builds.
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <div
          role="alert"
          className="mt-8 rounded border border-loss bg-surface px-4 py-3"
        >
          <p className="font-medium text-loss">Couldn’t load this build</p>
          <p className="text-[13px] text-muted">
            The server didn’t respond. Check that it’s running and reload.
          </p>
        </div>
      )}

      {state.kind === "ok" && (
        <>
          <p className="mt-4 text-[13px] text-muted">
            Build {buildNo(state.build.id)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-[40px] leading-[44px] font-medium tracking-[-0.01em]">
              {state.build.name}
            </h1>
            <StatusTag status={state.build.status} />
          </div>
        </>
      )}
    </main>
  );
}
