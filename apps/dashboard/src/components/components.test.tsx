import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApiClientError } from "../api/client.js";
import { ErrorState } from "./AsyncState.js";
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
});

