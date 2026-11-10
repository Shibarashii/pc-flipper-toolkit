import { useState } from "react";
import {
  Link,
  Navigate,
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
        <Link to="/" className="font-serif text-xl leading-7 font-medium">
          PC Flipper Toolkit
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

/** On every page: who made it, and the links that aren't part of the app itself. */
function Footer() {
  return (
    <footer className="flex flex-col gap-1 border-t border-line px-4 py-4 text-[13px] leading-[18px] text-muted sm:flex-row-reverse sm:justify-between sm:px-10">
      <p>
        <Link to="/privacy" className={footerLink}>
          Privacy
        </Link>
        {" · "}
        <a
          href="https://github.com/Shibarashii/pc-flipper-toolkit"
          className={footerLink}
        >
          GitHub
        </a>
      </p>
      <p>© 2026 Seanrei Valdeabella</p>
    </footer>
  );
}
