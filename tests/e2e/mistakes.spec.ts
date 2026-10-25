import { expect, test, type Page } from "@playwright/test";
import { newLearner } from "./helpers";

/** A completion-only reading set, so typed nonsense is guaranteed to be wrong. Questions 7–11 are short answers. */
const SET_TITLE = "Testing the Four-Day Week";
const WRONG = "zzzwrong";

async function submit(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Submit answers" }).first().click();
  await page.getByRole("button", { name: "Submit answers" }).last().click();
}

test("wrong answers can be retried as a drill and land in the notebook", async ({ page, baseURL }) => {
  await newLearner(page, baseURL);
  await page.goto("/practice?skill=reading");
  await page.locator("article", { hasText: SET_TITLE }).getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/attempt\//);
  const practiceUrl = page.url();

  for (const n of [7, 8, 9]) await page.getByRole("textbox", { name: new RegExp(`Answer ${n}$`) }).fill(WRONG);
  await submit(page);

  await expect(page.getByRole("heading", { name: /Results/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Answered 3/11")).toBeVisible();
  await expect(page.getByText(/no reliable band estimate/)).toBeVisible();

  // Star question 7 for the Bookmarks tab later.
  await page.getByRole("button", { name: "Bookmark this question (7)" }).click();
  await expect(page.getByText("Bookmarked", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove bookmark (7)" })).toHaveAttribute("aria-pressed", "true");

  // Retry opens a drill with exactly the three wrong questions.
  await page.getByRole("button", { name: "Retry wrong answers (3)" }).click();
  await expect(page).not.toHaveURL(practiceUrl);
  await expect(page).toHaveURL(/\/attempt\//);
  await expect(page.getByRole("textbox", { name: /Answer \d+$/ })).toHaveCount(3);
  await expect(page.getByRole("textbox", { name: /Answer 1$/ })).toHaveCount(0);

  await submit(page);
  await expect(page.getByRole("heading", { name: /Results: Mistake drill/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("0 of 3 mastered")).toBeVisible();

  await page.getByRole("link", { name: "Back to the notebook" }).first().click();
  await expect(page).toHaveURL(/\/mistakes$/);
  await expect(page.getByRole("heading", { name: SET_TITLE })).toBeVisible();
  await expect(page.getByText(WRONG)).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Drill selected (0)" })).toBeDisabled();

  await page.getByRole("checkbox", { name: "Select question 8" }).check();
  await expect(page.getByRole("button", { name: "Drill selected (1)" })).toBeEnabled();

  await page.getByRole("tab", { name: /Bookmarks/ }).click();
  await expect(page.getByRole("heading", { name: "Questions", exact: true })).toBeVisible();
  await expect(page.getByText(`${SET_TITLE} · Question 7`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Drill bookmarked questions" })).toBeVisible();
});

test("an empty notebook explains itself", async ({ page, baseURL }) => {
  await newLearner(page, baseURL);
  await page.goto("/mistakes");
  await expect(page.getByRole("heading", { level: 1, name: "Mistake notebook" })).toBeVisible();
  await expect(page.getByText("No mistakes yet")).toBeVisible();
  await page.getByRole("tab", { name: /Bookmarks/ }).click();
  await expect(page.getByText("Nothing bookmarked yet")).toBeVisible();
});
