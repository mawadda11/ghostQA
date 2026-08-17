import type { LocatorSpec } from "@ghostqa/shared";
import type { Locator, Page } from "playwright";

export const resolveLocator = (page: Page, spec: LocatorSpec): Locator => {
  switch (spec.kind) {
    case "ROLE":
      return page.getByRole(spec.role, {
        name: spec.name,
        ...(spec.exact === undefined ? {} : { exact: spec.exact }),
      });
    case "LABEL":
      return page.getByLabel(spec.text, {
        ...(spec.exact === undefined ? {} : { exact: spec.exact }),
      });
    case "TEXT":
      return page.getByText(spec.text, {
        ...(spec.exact === undefined ? {} : { exact: spec.exact }),
      });
    case "TEST_ID":
      return page.getByTestId(spec.value);
    case "CSS":
      return page.locator(spec.selector);
  }
};
