import { expect, type Page } from "@playwright/test";

/** Registers a fresh learner and finishes onboarding (English UI, Academic, target 7). */
export async function newLearner(page: Page, baseURL: string | undefined): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.context().addCookies([{ name: "bandup_locale", value: "en", url: baseURL ?? "http://localhost:3100" }]);
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Learner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.getByLabel("Target overall band").selectOption("7");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/onboarding\/placement$/);
  return email;
}
