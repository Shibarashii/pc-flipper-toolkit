import type { ReactNode } from "react";
import logo from "../../frontend/public/logo-light.png";
import { ThemeToggle } from "../../frontend/src/components/ThemeToggle";
import { buttonSecondary, iconButton } from "../../frontend/src/ui";

// The app's phone layout, 390px wide, scaled to the frame's width less 80px each side, in a
// hairline frame that runs off the bottom (specs/showcase-video.md, "Look").
const PHONE = 390;
const WIDTH = 1080 - 2 * 80;
const ZOOM = WIDTH / PHONE;
const HEIGHT = 1350 - 300;

export function Phone({ children }: { children: ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-t-[28px] border border-b-0 border-line-strong bg-bg"
      style={{ width: WIDTH, height: HEIGHT }}
    >
      <div style={{ width: PHONE, zoom: ZOOM }}>
        <Header />
        {children}
      </div>
    </div>
  );
}

/** App.tsx's header as a signed-in phone shows it: the logo alone below 410px. */
function Header() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
      <img src={logo} alt="" className="size-7" />
      <div className="flex min-w-0 items-center gap-2">
        <ThemeToggle />
        <span className={`shrink-0 text-muted ${iconButton}`}>
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
            <circle cx="8" cy="5.5" r="2.75" />
            <path d="M2.75 14a5.25 5.25 0 0 1 10.5 0" />
          </svg>
        </span>
        <span className={`shrink-0 ${buttonSecondary}`}>Log out</span>
      </div>
    </header>
  );
}
