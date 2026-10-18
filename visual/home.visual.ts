import { test } from "@playwright/test";
import { snapshot } from "stateofpixel/playwright";

test("home", async ({ page }) => {
  await page.goto("/");
  await snapshot(page, "Home");
  await page.emulateMedia({ colorScheme: "dark" });
  await snapshot(page, "Home dark");
});

test("og preview", async ({ page }) => {
  await page.goto("/og-preview/");
  await snapshot(page, "OG preview");
  await page.emulateMedia({ colorScheme: "dark" });
  await snapshot(page, "OG preview dark");
});
