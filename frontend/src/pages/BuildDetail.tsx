import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError, getBuild, type BuildDetail as Build } from "../api";
import { BuildChecklist } from "../components/BuildChecklist";
import { BuildHeader } from "../components/BuildHeader";
import { ExtraCosts } from "../components/ExtraCosts";
import { Notes } from "../components/Notes";
import { PartsTable, type PartsOpen } from "../components/PartsTable";
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
  const [partsOpen, setPartsOpen] = useState<PartsOpen>(null);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  // Header and notes saves return the whole build, totals included: show it at once.
  // Then refetch anyway: a GET already in flight (after a part change) may have read
  // the database before this save, and refreshing makes the page ignore it.
  const showBuild = (build: Build) => {
    setResult({ id: build.id, result: { kind: "ok", build } });
    refresh();
  };

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
          <BuildHeader
            // Remount per build so the drafts (name, price, date) start from its values.
            key={state.build.id}
            build={state.build}
            onUpdated={showBuild}
          />

          {/* Below 1280px: stacked, with the summary last. Wider: the summary is the
              right-hand column (narrower than that, the add-part row gets too cramped). */}
          <div className="mt-8 grid gap-12 sm:mt-12 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-14">
            <div className="flex min-w-0 flex-col gap-12">
              <BuildChecklist
                parts={state.build.parts}
                onAdd={(category) => setPartsOpen({ category })}
              />
              <PartsTable
                buildId={state.build.id}
                parts={state.build.parts}
                totals={state.build.totals}
                open={partsOpen}
                setOpen={setPartsOpen}
                onChanged={refresh}
              />
              <ExtraCosts
                buildId={state.build.id}
                costs={state.build.extra_costs}
                total={state.build.totals.extra_costs}
                onChanged={refresh}
              />
              <Notes
                key={state.build.id}
                build={state.build}
                onUpdated={showBuild}
              />
            </div>
            <Summary
              totals={state.build.totals}
              sellingPrice={state.build.selling_price}
            />
          </div>
        </>
      )}
    </main>
  );
}
