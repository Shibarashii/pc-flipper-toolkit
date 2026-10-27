import type { ReactNode } from "react";

/** A placeholder block standing in for content that's loading. Size it with className. */
export const Bone = ({ className = "" }: { className?: string }) => (
  <div className={`rounded bg-line ${className}`} />
);

/**
 * Wraps a page's placeholder blocks. Screen readers hear `label` once; the blocks
 * pulse, except with reduced motion.
 */
export function Skeleton({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden className="animate-pulse motion-reduce:animate-none">
        {children}
      </div>
    </div>
  );
}
