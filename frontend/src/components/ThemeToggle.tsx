import { useState } from "react";
import { iconButton } from "../ui";

type Theme = "light" | "dark";

// The saved choice (set in index.html before first paint), else the device's setting.
// ponytail: reads the device setting once; changing it while a page is open (with no
// saved choice) recolours the page but leaves this icon stale until reload.
function currentTheme(): Theme {
  const saved = document.documentElement.dataset.theme;
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Header button that flips light/dark and remembers the choice in this browser. */
export function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Still switched for this visit; it just won't survive a reload.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`shrink-0 text-muted hover:text-ink ${iconButton}`}
    >
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Shows the theme you'd switch to: a sun in dark mode, a moon in light. */}
        {next === "light" ? (
          <>
            <circle cx="8" cy="8" r="2.75" />
            <path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
          </>
        ) : (
          <path d="M13.5 9.6A5.75 5.75 0 1 1 6.4 2.5a4.5 4.5 0 0 0 7.1 7.1Z" />
        )}
      </svg>
    </button>
  );
}
