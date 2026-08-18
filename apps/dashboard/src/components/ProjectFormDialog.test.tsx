import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectFormDialog, validateProjectForm } from "./ProjectFormDialog.js";

describe("project form", () => {
  it("validates required name and absolute HTTP target URL", () => {
    expect(
      validateProjectForm({ name: "", description: "", baseUrl: "ftp://example.test" }),
    ).toEqual({
      name: "Project name is required.",
      baseUrl: "Target base URL must use HTTP or HTTPS.",
    });
  });

  it("blocks submission and renders useful field errors", async () => {
    const submit = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<ProjectFormDialog onClose={() => undefined} onSubmit={submit} />);

    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByText("Project name is required.")).toBeTruthy();
    expect(screen.getByText("Target base URL is required.")).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
  });

  it("submits a valid normalized project draft", async () => {
    const submit = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<ProjectFormDialog onClose={() => undefined} onSubmit={submit} />);

    await user.type(screen.getByLabelText("Project name"), "Customer portal");
    await user.type(
      screen.getByLabelText("Target base URL"),
      "http://127.0.0.1:4173",
    );
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(submit).toHaveBeenCalledWith({
      name: "Customer portal",
      baseUrl: "http://127.0.0.1:4173",
    });
  });
});
