import { useSyncExternalStore } from "react";

// Who's logged in, saved in this browser so it survives a reload.
const STORAGE_KEY = "session";

export type Session = { token: string; username: string };

type State = {
  session: Session | null;
  /** Shown on the log-in page, e.g. after the server ended the session. */
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

export const getToken = () => state.session?.token ?? "";

/** Demo accounts are named "demo-…"; sign-up refuses that prefix, so it's reliable. */
export const isDemo = (session: Session) =>
  session.username.startsWith("demo-");

export const saveSession = (session: Session) =>
  update({ session, notice: "" });

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
