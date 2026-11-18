import { useSyncExternalStore } from "react";

// Who's logged in, saved in this browser so it survives a reload.
const STORAGE_KEY = "session";

export type Session = { token: string; username: string };

type State = {
  session: Session | null;
  /** Shown once by the next page: the log-in page after the server ended the session,
   * or the builds list after sign-up. */
  notice: string;
};

const isSession = (value: unknown): value is Session =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Session).token === "string" &&
  typeof (value as Session).username === "string";

function load(): Session | null {
  // Storage can throw (blocked site data, some private windows): then nobody's logged in.
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null",
    );
    return isSession(saved) ? saved : null;
  } catch {
    return null;
  }
}

let state: State = { session: load(), notice: "" };
const listeners = new Set<() => void>();

function update(next: State) {
  state = next;
  try {
    if (next.session)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Still logged in for this visit; it just won't survive a reload.
  }
  listeners.forEach((listener) => listener());
}

// Another tab logged in or out, or got a new token from a password change: follow it, so
// this tab's next request doesn't 401 on the old token and end the session for both.
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  state = { session: load(), notice: "" };
  listeners.forEach((listener) => listener());
});

export const getToken = () => state.session?.token ?? "";

/** Demo accounts are named "demo-…"; sign-up refuses that prefix, so it's reliable. */
export const isDemo = (session: Session) =>
  session.username.startsWith("demo-");

export const saveSession = (session: Session, notice = "") =>
  update({ session, notice });

/** Once a page has shown the notice. */
export function clearNotice() {
  if (state.notice) update({ ...state, notice: "" });
}

/** After a rename or a new token. Does nothing once logged out, e.g. if Log out beat
 * the answer. */
export const updateSession = (fields: Partial<Session>) =>
  state.session &&
  update({ ...state, session: { ...state.session, ...fields } });

export const endSession = (notice = "") => update({ session: null, notice });

/** For when the server stops accepting the session. A demo has no password to log back in with. */
export const sessionEnded = () =>
  endSession(
    state.session && isDemo(state.session)
      ? "Your demo ended. Try it again or sign up."
      : "Your session ended. Log in again.",
  );

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useAuth = () => useSyncExternalStore(subscribe, () => state);
