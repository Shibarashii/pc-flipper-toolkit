// Shared class strings for the brand's Button and Field components (docs/brand-guidelines.md).

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const button = `rounded px-3.5 py-2 text-[14px] leading-5 font-medium disabled:opacity-45 ${focusRing}`;

export const buttonPrimary = `${button} bg-accent text-on-accent hover:bg-accent-hover`;

export const buttonSecondary = `${button} border border-line-strong bg-surface text-ink hover:bg-sunken`;

/** Secondary button with loss-coloured text, for destructive actions. */
export const buttonDanger = `${button} border border-line-strong bg-surface text-loss hover:bg-sunken`;

/** 28×28 ghost button around a 16px icon. Needs an aria-label. */
export const iconButton = `flex size-7 items-center justify-center rounded hover:bg-sunken disabled:opacity-45 ${focusRing}`;

/** Text input / select. Pass `error` to switch the border to the loss color. */
export const input = (error = false) =>
  `block w-full rounded border bg-surface py-2 pr-2.5 pl-3 text-[15px] leading-[22px] text-ink placeholder:text-faint ${focusRing} ${error ? "border-loss" : "border-line-strong"}`;
