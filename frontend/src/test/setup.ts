import { beforeEach } from "vitest";
import { saveSession } from "../auth";

// Most tests are of the logged-in pages; log-in tests end the session first.
beforeEach(() => saveSession({ token: "test-token", username: "alice" }));
