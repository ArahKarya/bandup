import { expect, test } from "@playwright/test";
import { newLearner } from "./helpers";

test("a new learner reaches the dashboard after onboarding", async ({ page, baseURL }) => {
  await newLearner(page, baseURL);
  await page.getByRole("link", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("a reading practice set is graded and shows a review", async ({ page, baseURL }) => {
  await newLearner(page, baseURL);
  await page.goto("/practice?skill=reading");
  await page.getByRole("button", { name: "Start" }).first().click();
  await expect(page).toHaveURL(/\/attempt\//);

  // Answer whatever the first question is, then submit.
  const tfng = page.getByRole("radio", { name: /^(TRUE|YES)$/ }).first();
  if (await tfng.isVisible().catch(() => false)) await tfng.click();
  await page.getByRole("button", { name: "Submit answers" }).first().click();
  await page.getByRole("button", { name: "Submit answers" }).last().click();

  await expect(page.getByRole("heading", { name: /Results/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("By question type")).toBeVisible();
});

test("mock test answers survive a reload (autosave)", async ({ page, baseURL }) => {
  await newLearner(page, baseURL);
  await page.goto("/mock");
  await page.getByRole("button", { name: "Start test" }).first().click();
  await expect(page).toHaveURL(/\/attempt\//);

  const first = page.getByRole("textbox", { name: /Answer 1$/ });
  await first.fill("Hargreaves");
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByRole("textbox", { name: /Answer 1$/ })).toHaveValue("Hargreaves");
});

test("a writing task can be submitted and self-assessed", async ({ page, baseURL }) => {
  await newLearner(page, baseURL);
  await page.goto("/practice?skill=writing");
  await page.getByRole("link", { name: "Start", exact: true }).first().click();
  await expect(page).toHaveURL(/\/practice\/writing\//);

  await page.getByPlaceholder("Write your answer here…").fill("The chart shows a clear upward trend over the period. ".repeat(20));
  await page.getByRole("button", { name: "Submit essay" }).click();
  await expect(page).toHaveURL(/\/writing\//);

  await page.getByLabel("Task Achievement / Response").selectOption("6.5");
  await page.getByRole("button", { name: "Save score" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByText("6.0").first()).toBeVisible();
});

test("a mock test moves from Listening to Reading when the section is closed", async ({ page, baseURL }) => {
  await newLearner(page, baseURL);
  await page.goto("/mock");
  await page.getByRole("button", { name: "Start test" }).first().click();
  await expect(page.getByText(/Listening · 1\/4/)).toBeVisible();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).last().click();
  await expect(page.getByText(/Reading · 2\/4/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Passage 1" })).toBeVisible();
});

test("the placement test runs to the end and estimates a band", async ({ page, baseURL }) => {
  await newLearner(page, baseURL);
  await page.getByRole("button", { name: "Take placement test" }).click();
  for (const section of ["Grammar · 1/3", "Reading · 2/3", "Listening · 3/3"]) {
    await expect(page.getByText(section)).toBeVisible({ timeout: 15_000 });
    const name = section.startsWith("Listening") ? "Submit answers" : "Next";
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("button", { name, exact: true }).last().click();
  }
  await expect(page.getByRole("heading", { name: /Results/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Estimated band")).toBeVisible();
});
