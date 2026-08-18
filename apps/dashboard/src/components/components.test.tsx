import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ApiClientError } from "../api/client.js";
import { ErrorState } from "./AsyncState.js";
import { ScreenshotViewer } from "./ScreenshotViewer.js";
import { StatusBadge } from "./StatusBadge.js";
import { SummaryCounts } from "./SummaryCounts.js";

describe("shared dashboard components", () => {
  it("renders status as visible text as well as color", () => {
    render(<StatusBadge status="NEEDS_REVIEW" />);
    const badge = screen.getByText("NEEDS REVIEW");
    expect(badge.className).toContain("amber");
  });

  it("renders all persisted summary counts", () => {
    render(
      <SummaryCounts
        summary={{ total: 6, passed: 1, failed: 4, needsReview: 1, errors: 0 }}
      />,
    );
    expect(screen.getByText("Passed")).toBeTruthy();
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.getByText("Errors")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("shows safe API errors without internal details", () => {
    render(
      <ErrorState
        error={new ApiClientError("Target hostname is not allowlisted.", "TARGET_NOT_ALLOWED", 400)}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Target hostname is not allowlisted.",
    );
  });

  it("closes the expanded screenshot with Escape", async () => {
    const user = userEvent.setup();
    render(
      <ScreenshotViewer
        artifact={{
          id: "artifact-one",
          kind: "SCREENSHOT",
          mimeType: "image/png",
          downloadUrl: "/api/artifacts/artifact-one",
          createdAt: "2026-01-01T00:00:00.000Z",
        }}
      />,
    );
    fireEvent.load(
      screen.getByAltText("Browser screenshot captured by GhostQA"),
    );
    await user.click(
      screen.getByRole("button", { name: "Open screenshot at full size" }),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
