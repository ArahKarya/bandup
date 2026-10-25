import { expect, test } from "@playwright/test";
import { newLearner } from "./helpers";

test("a new learner's dashboard shows the next step and the daily goal", async ({ page, baseURL }) => {
  await newLearner(page, baseURL);
  await page.getByRole("link", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const next = page.getByTestId("next-step");
  await expect(next).toBeVisible();
  await expect(next.getByText("Next best step")).toBeVisible();
  await expect(next.getByRole("link")).toHaveAttribute("href", /^\//);

  const goal = page.getByTestId("daily-goal");
  await expect(goal).toBeVisible();
  await expect(goal.getByRole("img", { name: /minutes studied today/ })).toBeVisible();
  await expect(page.getByRole("group", { name: /study minutes per day/ })).toBeVisible();
});

test("finishing a practice set unlocks the first-practice achievement", async ({ page, baseURL }) => {
  await newLearner(page, baseURL);
  await page.goto("/practice?skill=reading");
  await page.getByRole("button", { name: "Start" }).first().click();
  await expect(page).toHaveURL(/\/attempt\//);

  await page.getByRole("button", { name: "Submit answers" }).first().click();
  await page.getByRole("button", { name: "Submit answers" }).last().click();
  await expect(page.getByRole("heading", { name: /Results/ })).toBeVisible({ timeout: 15_000 });

  await page.goto("/achievements");
  await expect(page.getByRole("heading", { level: 1, name: "Achievements" })).toBeVisible();
  const badge = page.locator('[data-achievement="firstPractice"]');
  await expect(badge).toHaveAttribute("data-earned", "true");
  await expect(badge.getByText(/^Earned /)).toBeVisible();
  await expect(page.locator('[data-achievement="streak7"]')).toHaveAttribute("data-earned", "false");
});

test("the study plan offers an .ics calendar download", async ({ page, baseURL }) => {
  await newLearner(page, baseURL);
  await page.goto("/plan");
  const link = page.getByRole("link", { name: "Add to calendar (.ics)" });
  await expect(link).toHaveAttribute("href", "/api/plan/ics");

  const res = await page.request.get("/api/plan/ics");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  const body = await res.text();
  expect(body).toContain("BEGIN:VCALENDAR");
  expect(body).toContain("BEGIN:VEVENT");
});

test("the calendar export requires a session", async ({ playwright, baseURL }) => {
  const anon = await playwright.request.newContext({ baseURL });
  const res = await anon.get("/api/plan/ics");
  expect(res.status()).toBe(401);
  await anon.dispose();
});
