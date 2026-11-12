import { useState, type ReactNode } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { logOut } from "./api";
import { endSession, isDemo, useAuth } from "./auth";
import { ThemeToggle } from "./components/ThemeToggle";
import { BuildDetail } from "./pages/BuildDetail";
import { BuildsList } from "./pages/BuildsList";
import { Account } from "./pages/Account";
import { Login } from "./pages/Login";
import { Privacy } from "./pages/Privacy";
import { buttonSecondary, focusRing, iconButton, link } from "./ui";

export default function App() {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // The redirect to /login remembers the page you wanted, so logging in goes back to it. Only
  // for a link opened before anyone logged in: once a session ends (Log out, Exit demo, or the
  // server), the page belonged to that account.
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [hadSession, setHadSession] = useState(session !== null);
  if (session && !hadSession) setHadSession(true);

  async function logOutEverywhere() {
    // Log out here even if the server can't be reached; the token just lingers there.
    await logOut().catch(() => {});
    endSession();
  }

  // Ends the demo (its account is cleaned up later) and opens sign-up.
  async function signUpInstead() {
    await logOutEverywhere();
    navigate("/signup");
  }

  return (
    // A column at least as tall as the window: on short pages the footer sits at the bottom.
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-10">
        {/* The logo, then the name: one link home. Logged in, beside "Exit demo", the name
            needs a ~408px window, so narrower phones show the logo alone (named for screen
            readers). Logged out there's room, and the log-in page shows the name nowhere else. */}
        <Link
          to="/"
          aria-label="PC Flipper Toolkit"
          className={`flex shrink-0 items-center gap-2 rounded font-serif text-xl leading-7 font-medium ${focusRing}`}
        >
          <img src="/logo.png" alt="" className="size-7" />
          <span className={session ? "hidden min-[410px]:inline" : undefined}>
            PC Flipper Toolkit
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <ThemeToggle />
          {session && (
            <>
              {/* Opens Account: the username from 640px, an icon on phones. */}
              <Link
                to="/account"
                className={`hidden truncate text-[13px] font-medium text-muted hover:text-ink sm:block ${focusRing}`}
              >
                {session.username}
              </Link>
              <Link
                to="/account"
                aria-label="Account"
                title="Account"
                className={`shrink-0 text-muted hover:text-ink sm:hidden ${iconButton}`}
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
                  <circle cx="8" cy="5.5" r="2.75" />
                  <path d="M2.75 14a5.25 5.25 0 0 1 10.5 0" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={logOutEverywhere}
                className={`shrink-0 ${buttonSecondary}`}
              >
                {/* A demo has no account to come back to. */}
                {isDemo(session) ? "Exit demo" : "Log out"}
              </button>
            </>
          )}
        </div>
      </header>
      {session && isDemo(session) && (
        // One line with an inline link, so its action doesn't stack under "Log out".
        <p className="border-b border-line bg-sunken px-4 py-2.5 text-[13px] leading-[18px] sm:px-10">
          You’re trying a demo. It’s deleted after 24 hours.{" "}
          <button type="button" onClick={signUpInstead} className={link}>
            Sign up for your own account
          </button>
        </p>
      )}
      <div className="flex-1">
        {session ? (
          <Routes>
            <Route path="/" element={<BuildsList />} />
            <Route path="/builds/:id" element={<BuildDetail />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/account" element={<Account />} />
            {/* Where you land right after logging in or signing up. */}
            <Route path="/login" element={<Navigate to={from} replace />} />
            <Route path="/signup" element={<Navigate to={from} replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/login" element={<Login key="login" mode="login" />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route
              path="/signup"
              element={<Login key="signup" mode="signup" />}
            />
            <Route
              path="*"
              element={
                <Navigate
                  to="/login"
                  replace
                  state={
                    hadSession
                      ? undefined
                      : { from: location.pathname + location.search }
                  }
                />
              }
            />
          </Routes>
        )}
      </div>
      <Footer />
    </div>
  );
}

const footerLink = `rounded hover:text-ink ${focusRing}`;

/**
 * A 16px logo in a 24px target, named for screen readers. It leaves the app, so it opens
 * in a new tab (and says so); `noreferrer` also implies `noopener`.
 */
function IconLink({
  name,
  href,
  children,
}: {
  name: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${name} (opens in a new tab)`}
      title={name}
      className={`-my-1 inline-flex size-6 items-center justify-center ${footerLink}`}
    >
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        {children}
      </svg>
    </a>
  );
}

/** On every page: who made it, and the links that aren't part of the app itself. */
function Footer() {
  return (
    <footer className="flex flex-col-reverse gap-1 border-t border-line px-4 py-4 text-[13px] leading-[18px] text-muted sm:flex-row sm:justify-between sm:px-10">
      <p>© 2026 Seanrei Valdeabella</p>
      <p className="flex items-center gap-1">
        <NavLink to="/privacy" className={footerLink}>
          Privacy
        </NavLink>
        <span aria-hidden className="mx-1">
          ·
        </span>
        {/* Logos: GitHub's from Octicons, LinkedIn's from Bootstrap Icons (both MIT). */}
        <IconLink
          name="GitHub"
          href="https://github.com/Shibarashii/pc-flipper-toolkit"
        >
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
        </IconLink>
        <IconLink
          name="LinkedIn"
          href="https://www.linkedin.com/in/seanrei-valdeabella/"
        >
          <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z" />
        </IconLink>
      </p>
    </footer>
  );
}
