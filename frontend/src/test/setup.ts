import { beforeEach } from "vitest";
import { saveSession } from "../auth";

// Most tests are of the logged-in pages; log-in tests end the session first.
beforeEach(() => saveSession({ token: "test-token", username: "alice" }));

// jsdom has no matchMedia; browsers always do. Here the device is light, unless a
// test stubs it (vi.stubGlobal("matchMedia", …)).
window.matchMedia = (query: string) =>
  ({ matches: false, media: query }) as MediaQueryList;

// jsdom has no modal dialogs: opening one just marks it open.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
