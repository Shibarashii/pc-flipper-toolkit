import type { ReactNode } from "react";
import { useSlow, WakingNote } from "./Waiting";

/** A placeholder block standing in for content that's loading. Size it with className. */
export const Bone = ({ className = "" }: { className?: string }) => (
  <div className={`rounded bg-line ${className}`} />
);

/**
 * Wraps a page's placeholder blocks. Screen readers hear `label` once; the blocks
 * pulse, except with reduced motion. After 5 seconds the waking note shows above them,
 * unless `note` is false (a second skeleton on the same page).
 */
export function Skeleton({
  label,
  className = "",
  note = true,
  children,
}: {
  label: string;
  className?: string;
  note?: boolean;
  children: ReactNode;
}) {
  const slow = useSlow(note);
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      {slow && <WakingNote live={false} className="py-3" />}
      <div aria-hidden className="animate-pulse motion-reduce:animate-none">
        {children}
      </div>
    </div>
  );
}
