import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import type { Part } from "../api";
import { makeBuild } from "../test/fixtures";
import { BuildHeader } from "./BuildHeader";
import { ListingDialog } from "./ListingDialog";

beforeAll(() => {
  // jsdom doesn't implement modal dialogs.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
});

afterEach(cleanup);

const build = makeBuild({
  name: "Ryzen 5 5600 + RX 6600",
  selling_price: "32000.00",
  parts: [
    { id: 1, category: "cpu", name: "Ryzen 5 5600" } as Part,
    { id: 2, category: "gpu", name: "RX 6600 8GB" } as Part,
  ],
});
const post =
  "Ryzen 5 5600 + RX 6600\n\nCPU: Ryzen 5 5600\nGPU: RX 6600 8GB\n\nPrice: ₱32,000";

/** jsdom has no clipboard; this one copies, or refuses like a page without permission. */
function stubClipboard(works = true) {
  const writeText = vi.fn(() =>
    works ? Promise.resolve() : Promise.reject(new DOMException("Denied")),
  );
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

const textBox = () =>
  screen.getByRole("textbox", { name: "Listing" }) as HTMLTextAreaElement;

test("opens with the post, and Copy has the focus", () => {
  render(<ListingDialog build={build} onClose={() => {}} />);

  expect(screen.getByRole("dialog", { name: "Copy listing" })).toBeTruthy();
  expect(textBox().value).toBe(post);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Copy" }),
  );
});

test("Copy copies the text as edited, then says Copied", async () => {
  const writeText = stubClipboard();
  render(<ListingDialog build={build} onClose={() => {}} />);

  fireEvent.change(textBox(), {
    target: { value: `${post}\n\nMeetup in QC.` },
  });
  fireEvent.click(screen.getByRole("button", { name: "Copy" }));

  expect(await screen.findByText("Copied")).toBe(screen.getByRole("status"));
  expect(writeText).toHaveBeenCalledWith(`${post}\n\nMeetup in QC.`);
});

test("a failed copy selects the text and says how to copy it", async () => {
  stubClipboard(false);
  render(<ListingDialog build={build} onClose={() => {}} />);

  fireEvent.click(screen.getByRole("button", { name: "Copy" }));

  expect(
    await screen.findByText(
      "Couldn’t copy. The text is selected: press Ctrl+C, or use your phone’s Copy.",
    ),
  ).toBeTruthy();
  expect(textBox().selectionStart).toBe(0);
  expect(textBox().selectionEnd).toBe(post.length);
});

test("Close closes it", () => {
  const onClose = vi.fn();
  render(<ListingDialog build={build} onClose={onClose} />);

  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  expect(onClose).toHaveBeenCalled();
});

test("from the build header; reopening starts from the made post, not the edits", () => {
  render(<BuildHeader build={build} onUpdated={() => {}} />);

  fireEvent.click(screen.getByRole("button", { name: "Copy listing" }));
  fireEvent.change(textBox(), { target: { value: "edited" } });
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Copy listing" }));
  expect(textBox().value).toBe(post);
});
