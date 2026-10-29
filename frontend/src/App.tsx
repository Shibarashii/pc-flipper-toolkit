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
import { Login } from "./pages/Login";
import { buttonSecondary, link } from "./ui";

export default function App() {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Set by the redirect to /login, so logging in goes back to the page you wanted.
  const from = (location.state as { from?: string } | null)?.from ?? "/";

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
