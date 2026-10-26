import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError, getBuild, type BuildDetail as Build } from "../api";
import { buildNo } from "../buildNo";
import { ExtraCosts } from "../components/ExtraCosts";
import { PartsTable } from "../components/PartsTable";
import { StatusTag } from "../components/StatusTag";
import { Summary } from "../components/Summary";

type Result =
  { kind: "error" } | { kind: "not-found" } | { kind: "ok"; build: Build };

export function BuildDetail() {
  const id = Number(useParams().id);
  const validId = Number.isInteger(id) && id > 0;
  // Tagged with the id it belongs to, so navigating to another build shows "loading".
  const [result, setResult] = useState<{ id: number; result: Result } | null>(
    null,
  );
  // Bumped after every change; refetching keeps showing the current data meanwhile.
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

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
  }, [id, validId, version]);

  const state: Result | { kind: "loading" } = !validId
    ? { kind: "not-found" }
    : result?.id === id
      ? result.result
      : { kind: "loading" };

  return (
    <main className="mx-auto max-w-[1216px] px-4 pt-6 pb-10 sm:px-8 sm:pt-8">
      <Link
        to="/"
        className="text-[13px] leading-[18px] font-medium text-muted hover:text-ink"
      >
        ← All builds
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
          <div className="mt-2.5 flex items-center gap-2.5 pt-2">
            <StatusTag status={state.build.status} />
            <span className="text-[13px] leading-[18px] text-muted">
              Build {buildNo(state.build.id)}
            </span>
          </div>
          <h1 className="mt-2.5 font-serif text-[40px] leading-[44px] font-medium tracking-[-0.01em]">
            {state.build.name}
          </h1>

          {/* Below 1280px: summary first, stacked. Wider: summary is the right-hand column
              (narrower than that, the add-part row gets too cramped). */}
          <div className="mt-8 grid gap-8 sm:mt-12 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-14">
            <div className="xl:col-start-2 xl:row-start-1">
              <Summary
                totals={state.build.totals}
                sellingPrice={state.build.selling_price}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-12 xl:col-start-1 xl:row-start-1">
              <PartsTable
                buildId={state.build.id}
                parts={state.build.parts}
                totals={state.build.totals}
                onChanged={refresh}
              />
              <ExtraCosts
                buildId={state.build.id}
                costs={state.build.extra_costs}
                total={state.build.totals.extra_costs}
                onChanged={refresh}
              />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
