import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const RESULTS_PATH = path.resolve(__dirname, '.ui-parity.json');

const fillTestInput = async (page, testId: string, value: string) => {
  const locator = page.getByTestId(testId);
  const handle = await locator.elementHandle();
  if (!handle) {
    throw new Error(`Locator ${testId} not found`);
  }
  const tag = await handle.evaluate(el => el.tagName);
  if (tag === 'INPUT') {
    await locator.fill(value);
  } else {
    await locator.locator('input').fill(value);
  }
};

test.beforeAll(async ({}, testInfo) => {
  if (testInfo.project.name === 'ui-v2' && fs.existsSync(RESULTS_PATH)) {
    fs.unlinkSync(RESULTS_PATH);
  }
});

test('calculates totals consistently across UI versions', async ({ page }, testInfo) => {
  await page.goto('/');

  await fillTestInput(page, 'din-quantity-0', '4');
  await fillTestInput(page, 'din-weight-0', '480');
  await fillTestInput(page, 'eup-quantity-0', '6');
  await fillTestInput(page, 'eup-weight-0', '350');

  const dinCheckbox = testInfo.project.name === 'ui-v2' ? '#din-stackable-modern' : '#dinStackable';
  const eupCheckbox = testInfo.project.name === 'ui-v2' ? '#eup-stackable-modern' : '#eupStackable';

  if (await page.locator(dinCheckbox).isEnabled()) {
    await page.locator(dinCheckbox).check({ force: true });
  }
  if (await page.locator(eupCheckbox).isEnabled()) {
    await page.locator(eupCheckbox).check({ force: true });
  }

  const optimizeButton = page.getByRole('button', { name: /Layout optimieren/i });
  if (await optimizeButton.count()) {
    await optimizeButton.first().click();
  }

  const stackedLocator = page.locator('[data-testid="stacked-pallet"]');
  if (testInfo.project.name === 'ui-v2') {
    await expect(stackedLocator.first()).toBeVisible();
  }

  const totalPalletsValue = (await page.getByTestId('kpi-total-pallets').locator('span').nth(1).innerText()).trim();
  const totalWeightValue = (await page.getByTestId('kpi-total-weight').locator('span').nth(1).innerText()).trim();
  const marginValue = (await page.getByTestId('kpi-weight-margin').locator('span').nth(1).innerText()).trim();

  const results = fs.existsSync(RESULTS_PATH)
    ? JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf-8'))
    : {};

  results[testInfo.project.name] = {
    totalPalletsValue,
    totalWeightValue,
    marginValue,
  };

  fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));

  if (results['ui-v2'] && results['legacy']) {
    expect(results['ui-v2']).toEqual(results['legacy']);
  }
});

test('tab order moves from rail to canvas toolbar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'ui-v2');

  await page.goto('/');
  const layoutButton = page.getByRole('button', { name: 'Layout optimieren' });
  await layoutButton.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Alles zurücksetzen' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Herauszoomen' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Hereinzoomen' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Ansicht zurücksetzen' })).toBeFocused();
});
