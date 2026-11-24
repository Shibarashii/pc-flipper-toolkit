import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* No transitions: a page change and the session it depends on (Log out, then Sign up)
        land in one render, so no page shows for a moment without its session. The app has
        no Suspense, so transitions would buy nothing. */}
    <BrowserRouter useTransitions={false}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
