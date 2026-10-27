import { Link, Navigate, Route, Routes, useLocation } from "react-router";
import { logOut } from "./api";
import { endSession, useAuth } from "./auth";
import { ThemeToggle } from "./components/ThemeToggle";
import { BuildDetail } from "./pages/BuildDetail";
import { BuildsList } from "./pages/BuildsList";
import { Login } from "./pages/Login";
import { buttonSecondary } from "./ui";

export default function App() {
  const { session } = useAuth();
  const location = useLocation();
  // Set by the redirect to /login, so logging in goes back to the page you wanted.
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  async function logOutEverywhere() {
    // Log out here even if the server can't be reached; the token just lingers there.
    await logOut().catch(() => {});
    endSession();
  }

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-10">
        <Link to="/" className="font-serif text-xl leading-7 font-medium">
          PC Flipper Toolkit
        </Link>
        <div className="flex min-w-0 items-center gap-4">
          <ThemeToggle />
          {session && (
            <>
              <span className="hidden truncate text-[13px] font-medium text-muted sm:block">
                {session.username}
              </span>
              <button
                type="button"
                onClick={logOutEverywhere}
                className={`shrink-0 ${buttonSecondary}`}
              >
                Log out
              </button>
            </>
          )}
        </div>
      </header>
      {session ? (
        <Routes>
          <Route path="/" element={<BuildsList />} />
          <Route path="/builds/:id" element={<BuildDetail />} />
          {/* Where you land right after logging in or signing up. */}
          <Route path="/login" element={<Navigate to={from} replace />} />
          <Route path="/signup" element={<Navigate to={from} replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/login" element={<Login key="login" mode="login" />} />
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
                state={{ from: location.pathname + location.search }}
              />
            }
          />
        </Routes>
      )}
    </>
  );
}
