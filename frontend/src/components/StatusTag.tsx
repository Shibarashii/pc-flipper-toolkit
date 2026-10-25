import type { BuildStatus } from "../api";

const styles: Record<BuildStatus, string> = {
  planning: "border-muted text-muted",
  building: "border-status-building text-status-building",
  listed: "border-status-listed text-status-listed",
  sold: "border-profit text-profit",
};

export function StatusTag({ status }: { status: BuildStatus }) {
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-[13px] font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}
