import { test, expect } from '@playwright/test';

const parseNumber = (value: string | null) => {
  if (!value) return 0;
  const digits = value.replace(/[^0-9]/g, '');
  return Number.parseInt(digits || '0', 10);
};

test('modern UI matches legacy metrics and preserves accessibility cues', async ({ page, context }) => {
  await page.goto('/');

  // Fill DIN quantities and weights
  const dinQuantityInput = page.getByLabel('Anzahl').first();
  const eupQuantityInput = page.getByLabel('Anzahl').nth(1);
  await dinQuantityInput.fill('2');
  await eupQuantityInput.fill('3');

  const weightInputs = page.getByLabel('Gewicht (kg)');
  await weightInputs.first().fill('500');
  await weightInputs.nth(1).fill('400');

  await page.waitForTimeout(400);

  const totalPalletsText = await page
    .getByRole('status', { name: /Geladene Paletten/i })
    .locator('p')
    .nth(1)
    .innerText();
  const totalWeightText = await page
    .getByRole('status', { name: /Berechnetes Gewicht/i })
    .locator('p')
    .nth(1)
    .innerText();

  const newTotals = {
    pallets: parseNumber(totalPalletsText),
    weight: parseNumber(totalWeightText),
  };

  // Verify tab order reaches toolbar controls
  await page.getByRole('button', { name: 'Layout optimieren' }).focus();
  await page.keyboard.press('Tab');
  const afterOptimize = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
  expect(afterOptimize).toContain('Alles zurücksetzen');

  await page.keyboard.press('Tab');
  let focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
  expect(focusedLabel).toBe('Ansicht verkleinern');

  await page.keyboard.press('Tab');
  focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
  expect(focusedLabel).toBe('Ansicht vergrößern');

  await page.keyboard.press('Tab');
  focusedLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
  expect(focusedLabel).toBe('Ansicht zurücksetzen');

  // Enable stacking to verify striped styling
  await eupQuantityInput.fill('2');
  const eupSwitch = page.getByRole('switch', { name: 'Stapelbar (2-fach)' }).nth(1);
  await eupSwitch.click();
  await expect(page.locator('.pallet--stacked').first()).toBeVisible();

  // Legacy UI comparison
  const legacyPage = await context.newPage();
  await legacyPage.goto('/?ui=legacy');

  const legacyQuantityInputs = legacyPage.getByPlaceholder('Anzahl');
  await legacyQuantityInputs.first().fill('2');
  await legacyQuantityInputs.nth(1).fill('3');

  const legacyDinWeight = legacyPage.getByPlaceholder('Gewicht/DIN');
  await legacyDinWeight.fill('500');
  const legacyEupWeight = legacyPage.getByPlaceholder('Gewicht/EUP');
  await legacyEupWeight.fill('400');

  await legacyPage.waitForTimeout(400);

  const legacyDinText = await legacyPage.locator('text=Industrie (DIN):').first().textContent();
  const legacyEupText = await legacyPage.locator('text=Euro (EUP):').first().textContent();
  const legacyWeightCard = legacyPage.getByRole('heading', { name: 'Geschätztes Gewicht' }).locator('..');
  const legacyWeightText = await legacyWeightCard.locator('p').first().textContent();

  const legacyTotals = {
    pallets: parseNumber(legacyDinText) + parseNumber(legacyEupText),
    weight: parseNumber(legacyWeightText),
  };

  expect(newTotals.pallets).toBe(legacyTotals.pallets);
  expect(newTotals.weight).toBe(legacyTotals.weight);
});
