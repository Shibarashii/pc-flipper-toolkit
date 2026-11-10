import { useEffect, useRef } from "react";
import { currentTheme } from "./components/ThemeToggle";

/** Google's sign-in button (docs/specs/google-sign-in.md). Google's own script draws it and
 * hands back an ID token, which the API checks. */

type Gis = {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }): void;
      renderButton(parent: HTMLElement, options: object): void;
    };
  };
};

declare global {
  interface Window {
    google?: Gis;
  }
}

/** The OAuth client's id (public). Unset, there's no Google sign-in anywhere. */
export const googleClientId = (): string =>
  import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

let script: Promise<Gis> | null = null;
let initialized: Gis | null = null;
// Google allows one callback per page; it calls whichever button is on screen.
let onCredential: (credential: string) => void = () => {};

/** Google's script, loaded once, set up once. */
async function gis(): Promise<Gis> {
  const g =
    window.google ??
    (await (script ??= new Promise<Gis>((resolve, reject) => {
      const tag = document.createElement("script");
      // hl: the stand-in button the script draws before its real one is in English too.
      tag.src = "https://accounts.google.com/gsi/client?hl=en";
      tag.async = true;
      tag.onload = () =>
        window.google ? resolve(window.google) : reject(new Error("no gis"));
      tag.onerror = () => {
        script = null; // so the next page can try again
        tag.remove();
        reject(new Error("couldn't load gis"));
      };
      document.head.append(tag);
    })));
  if (initialized !== g) {
    g.accounts.id.initialize({
      client_id: googleClientId(),
      callback: (response) => onCredential(response.credential),
    });
    initialized = g;
  }
  return g;
}

/** Google's "Sign in with Google" button, as wide as its container. */
export function GoogleButton({
  onCredential: handle,
  onError,
}: {
  onCredential: (credential: string) => void;
  onError: () => void;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ handle, onError });
  useEffect(() => {
    callbacks.current = { handle, onError };
  });

  useEffect(() => {
    let live = true;
    gis().then(
      (g) => {
        if (!live || !parent.current) return;
        onCredential = (credential) => callbacks.current.handle(credential);
        g.accounts.id.renderButton(parent.current, {
          theme: currentTheme() === "dark" ? "filled_black" : "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "center",
          // Google picks the language from the location otherwise; the app is in English.
          locale: "en",
          // Google's limits: 200 to 400 pixels.
          width: Math.min(400, Math.max(200, parent.current.clientWidth)),
        });
      },
      () => live && callbacks.current.onError(),
    );
    return () => {
      live = false;
    };
  }, []);

  // Google's button is 40px high: keep the room while it loads. Its frame is a light page;
  // inside our dark theme the browser would paint it an opaque white background, unless
  // the frame's container is light too. While the frame loads, Google also draws a stand-in
  // next to it whose styles our CSP blocks (a full-width logo): only the frame is shown.
  return (
    <div
      ref={parent}
      className="min-h-10 [color-scheme:light] [&>div>:not(iframe)]:hidden"
    />
  );
}
