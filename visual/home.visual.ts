import { test } from "@playwright/test";
import { snapshot } from "stateofpixel/playwright";

test("home", async ({ page }) => {
  await page.goto("/");
  await snapshot(page, "Home");
  await page.emulateMedia({ colorScheme: "dark" });
  await snapshot(page, "Home dark");
});

test("og preview", async ({ page }) => {
  await page.goto("/og-preview");
  await snapshot(page, "OG preview");
  await page.emulateMedia({ colorScheme: "dark" });
  await snapshot(page, "OG preview dark");
});

test("security headers", async ({ page }) => {
  await page.goto("/security-headers");
  await snapshot(page, "Security headers");
  await page.emulateMedia({ colorScheme: "dark" });
  await snapshot(page, "Security headers dark");
});

test("agent readability", async ({ page }) => {
  await page.goto("/agent-readability");
  await snapshot(page, "Agent readability");
  await page.emulateMedia({ colorScheme: "dark" });
  await snapshot(page, "Agent readability dark");
});

test("favicon checker", async ({ page }) => {
  await page.goto("/favicon-checker");
  await snapshot(page, "Favicon checker");
  await page.emulateMedia({ colorScheme: "dark" });
  await snapshot(page, "Favicon checker dark");
});
