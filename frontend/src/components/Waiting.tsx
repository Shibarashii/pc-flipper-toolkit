import { useEffect, useState, type ReactNode } from "react";

// While a request waits on the API, which sleeps on Render's free plan (specs/waking-note.md).

/** 14px ring in the text's color; still under reduced motion, where the words say it all. */
export const Spinner = () => (
  <svg
    aria-hidden
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
  >
    <circle cx="7" cy="7" r="5.75" opacity="0.25" />
    <path d="M7 1.25A5.75 5.75 0 0 1 12.75 7" strokeLinecap="round" />
  </svg>
);

/** A button's label while it works: the spinner, then the words. */
export const Working = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center justify-center gap-2">
    <Spinner />
    {children}
  </span>
);

/** True once `active` has held for 5 seconds; false again as soon as it stops. */
export function useSlow(active: boolean) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [active]);
  return slow;
}

/** A live region of its own, unless it's inside one already (`live={false}`, as in a Skeleton). */
export const WakingNote = ({
  className = "",
  live = true,
}: {
  className?: string;
  live?: boolean;
}) => (
  <p
    role={live ? "status" : undefined}
    className={`text-[13px] leading-[18px] text-muted ${className}`}
  >
    Waking up the server — this can take up to a minute. It runs on Render’s
    free plan, which sleeps when nobody’s using it.
  </p>
);
