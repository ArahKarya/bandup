import { expect, test, type Page } from "@playwright/test";
import { newLearner } from "./helpers";

/** Focus-mode runner: annotations, flags, mobile tabs and exam settings. */

async function startReading(page: Page, baseURL: string | undefined): Promise<void> {
  await newLearner(page, baseURL);
  await page.goto("/practice?skill=reading");
  await page.getByRole("button", { name: "Start" }).first().click();
  await expect(page).toHaveURL(/\/attempt\//);
  await expect(page.getByRole("navigation", { name: "Question navigator" })).toBeVisible();
}

/** Selects characters [start, end) of a passage paragraph, as a mouse drag would. */
async function selectInBlock(page: Page, block: number, start: number, end: number): Promise<void> {
  await page.evaluate(
    ({ block, start, end }) => {
      const el = document.querySelector(`article [data-block-text="${block}"]`);
      if (!el) throw new Error(`block ${block} not found`);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let seen = 0;
      let startSet = false;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const len = node.textContent?.length ?? 0;
        if (!startSet && start <= seen + len) {
          range.setStart(node, start - seen);
          startSet = true;
        }
        if (startSet && end <= seen + len) {
          range.setEnd(node, end - seen);
          break;
        }
        seen += len;
      }
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    },
    { block, start, end },
  );
}

async function waitForSave(page: Page): Promise<void> {
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 15_000 });
}

test("highlights and notes in a reading passage survive a reload", async ({ page, baseURL }) => {
  await startReading(page, baseURL);

  await selectInBlock(page, 0, 0, 12);
  await page.getByRole("toolbar").getByRole("button", { name: "Highlight" }).click();
  await expect(page.locator("article mark.hl")).toHaveCount(1);

  await selectInBlock(page, 1, 0, 10);
  await page.getByRole("toolbar").getByRole("button", { name: "Note" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("Key idea here");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.locator("article mark.hl-note")).toHaveAttribute("data-note", "Key idea here");

  await waitForSave(page);
  await page.reload();
  await expect(page.locator("article mark.hl")).toHaveCount(1);
  const note = page.locator("article mark.hl-note");
  await expect(note).toHaveAttribute("data-note", "Key idea here");

  // Clicking the note opens the editor; deleting it removes the mark.
  await note.click();
  await page.getByRole("button", { name: "Delete note" }).click();
  await expect(page.locator("article mark.hl-note")).toHaveCount(0);
});

test("a flagged question is marked in the navigator after a reload", async ({ page, baseURL }) => {
  await startReading(page, baseURL);

  const nav = page.getByRole("navigation", { name: "Question navigator" });
  // Open question 1 from the navigator, then flag it with the navigator's flag control
  // (works for every question type, including gap-fill blanks).
  await nav.getByRole("button", { name: /^Question 1,/ }).click();
  const n = "1";
  await nav.getByRole("button", { name: "Flag for review (1)" }).click();
  await expect(nav.getByRole("button", { name: "Remove flag (1)" })).toHaveAttribute("aria-pressed", "true");

  const paletteButton = page.getByRole("navigation", { name: "Question navigator" }).getByRole("button", { name: new RegExp(`^Question ${n},.*flagged$`) });
  await expect(paletteButton).toBeVisible();

  await waitForSave(page);
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Question navigator" }).getByRole("button", { name: new RegExp(`^Question ${n},.*flagged$`) })).toBeVisible();
});

test("on a phone, tabs switch between the passage and the questions", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startReading(page, baseURL);

  const passage = page.locator("article").first();
  await expect(page.getByRole("tab", { name: "Questions" })).toHaveAttribute("aria-selected", "true");
  await expect(passage).toBeHidden();

  await page.getByRole("tab", { name: "Passage" }).click();
  await expect(passage).toBeVisible();

  await page.getByRole("tab", { name: "Questions" }).click();
  await expect(passage).toBeHidden();
  await page.getByRole("button", { name: "View passage" }).click();
  await expect(passage).toBeVisible();
});

test("exam settings change the text size and are remembered", async ({ page, baseURL }) => {
  await startReading(page, baseURL);
  const passage = page.locator("article").first();
  const before = await passage.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));

  await page.getByRole("button", { name: "Exam settings" }).click();
  await page.getByRole("dialog", { name: "Exam settings" }).getByText("Large").click();
  await expect.poll(() => passage.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(before);

  await page.reload();
  await expect.poll(() => page.locator("article").first().evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(before);
});
