import { expect, test } from "@playwright/test";
import { newLearner } from "./helpers";

const TASK_2 = "/practice/writing/wt-t2-car-free-city-centres";

test("the writing planner builds an outline and the analysis panel follows the text", async ({ page, baseURL }) => {
  await newLearner(page, baseURL);
  await page.goto(TASK_2);

  // Planner: collapsed by default, opens on click, outline goes into the editor.
  await page.locator("summary", { hasText: "Plan" }).click();
  await page.getByLabel("Position / thesis").fill("I strongly believe that city centres should be car-free.");
  await page.getByLabel("Body idea 1").fill("Cleaner air improves public health");
  await page.getByRole("button", { name: "Use plan as outline" }).click();

  const editor = page.getByRole("textbox", { name: "Write your answer here…" });
  await expect(editor).toHaveValue(/I strongly believe that city centres should be car-free\./);
  await expect(editor).toHaveValue(/Firstly, cleaner air improves public health\./);

  const outline = await editor.inputValue();
  await editor.fill(
    `${outline}\n\nHowever, some drivers would lose convenience, because buses are slower than cars.\n\nIn conclusion, the benefits outweigh the drawbacks.`,
  );

  // Analysis is debounced; it lists the linking words found and one bar per paragraph.
  const analysis = page.getByTestId("writing-analysis");
  await expect(analysis.getByText("however", { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(analysis.getByText("in conclusion", { exact: true })).toBeVisible();
  await expect(analysis.getByText("Paragraph 6")).toBeVisible();
  await expect(analysis.getByText("Your position is stated.")).toBeVisible();

  await page.getByRole("button", { name: "Submit essay" }).click();
  await expect(page).toHaveURL(/\/writing\//);

  // The submission page shows the same analysis, read-only.
  const submitted = page.getByTestId("writing-analysis");
  await expect(submitted).toBeVisible();
  await expect(submitted.getByText("however", { exact: true })).toBeVisible();
  await expect(submitted.getByText("Paragraph 6")).toBeVisible();
});
