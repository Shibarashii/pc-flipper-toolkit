import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { IconButton } from "./form";

// PR #101 left the edit icon as `d="pencil"`, which draws nothing.
test.each(["edit", "delete", "listing"] as const)(
  "the %s icon draws a real path",
  (action) => {
    const { container } = render(
      <IconButton action={action} label={action} onClick={() => {}} />,
    );
    for (const path of container.querySelectorAll("path")) {
      expect(path.getAttribute("d")).toMatch(/^M/);
    }
  },
);
