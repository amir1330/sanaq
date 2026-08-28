import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./ui";

vi.mock("../i18n", () => ({
  useT: () => (key: string) => (key === "common.close" ? "Close" : key),
}));

describe("product dialog shell", () => {
  it("renders title, form fields, and save when open", async () => {
    const onClose = vi.fn();
    render(
      <Dialog open title="New product" onClose={onClose} size="xl">
        <form>
          <label>
            Name
            <input aria-label="Product name" />
          </label>
          <button type="submit">Save</button>
        </form>
      </Dialog>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New product" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Product name" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders nothing when closed", () => {
    render(
      <Dialog open={false} title="Hidden" onClose={() => {}}>
        <p>content</p>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
