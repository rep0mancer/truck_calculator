import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

async function fillCommonInputs(page: Page, url: string = BASE_URL) {
  await page.goto(url);
  await page.getByLabel(/LKW-Typ/i).selectOption('curtainSider');
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill('4');
  await numberInputs.nth(1).fill('480');
  await numberInputs.nth(2).fill('6');
  await numberInputs.nth(3).fill('360');
}

function parseKg(text: string): number {
  const cleaned = text.replace(/[^0-9-]/g, '');
  return Number.parseInt(cleaned || '0', 10);
}

async function readModernKPIs(page: Page) {
  const loadedCard = page.locator('div').filter({ has: page.getByText('Geladene Paletten') }).first();
  const weightCard = page.locator('div').filter({ has: page.getByText('Gesamtgewicht') }).first();
  const marginCard = page.locator('div').filter({ has: page.getByText('Gewichtsmarge') }).first();

  const loadedValue = await loadedCard.locator('span').nth(1).innerText();
  const weightValue = await weightCard.locator('span').nth(1).innerText();
  const marginValue = await marginCard.locator('span').nth(1).innerText();

  return {
    pallets: Number.parseInt(loadedValue.replace(/[^0-9]/g, ''), 10),
    weightKg: parseKg(weightValue),
    marginKg: parseKg(marginValue),
  };
}

async function readLegacyKPIs(page: Page) {
  const palletsCardText = await page.locator('div').filter({ hasText: 'Geladene Paletten (Visuell)' }).first().innerText();
  const dinMatch = palletsCardText.match(/Industrie \(DIN\):\s*(\d+)/);
  const eupMatch = palletsCardText.match(/Euro \(EUP\):\s*(\d+)/);
  const totalPallets = Number.parseInt(dinMatch?.[1] ?? '0', 10) + Number.parseInt(eupMatch?.[1] ?? '0', 10);

  const weightCardText = await page.locator('div').filter({ hasText: 'Geschätztes Gewicht' }).first().innerText();
  const weightMatch = weightCardText.match(/([\d.]+)\s*kg/);
  const maxMatch = weightCardText.match(/Max:\s*([\d.]+)\s*kg/);
  const weightKg = Number.parseInt((weightMatch?.[1] ?? '0').replace(/\./g, ''), 10);
  const maxKg = Number.parseInt((maxMatch?.[1] ?? '0').replace(/\./g, ''), 10);

  return {
    pallets: totalPallets,
    weightKg,
    marginKg: maxKg - weightKg,
  };
}

async function compareWithLegacy(context: BrowserContext, modernMetrics: { pallets: number; weightKg: number; marginKg: number }) {
  const legacyUrl = process.env.LEGACY_BASE_URL;
  if (!legacyUrl) {
    test.skip(true, 'Set LEGACY_BASE_URL to compare against the legacy UI.');
  }
  const legacyPage = await context.newPage();
  await fillCommonInputs(legacyPage, legacyUrl!);
  await legacyPage.waitForTimeout(300);
  const legacyMetrics = await readLegacyKPIs(legacyPage);
  expect(legacyMetrics).toEqual(modernMetrics);
}

test.describe('UI V2 non-regression', () => {
  test('matches legacy totals', async ({ page, context }) => {
    await fillCommonInputs(page);
    await page.waitForTimeout(300);
    const modernMetrics = await readModernKPIs(page);
    await compareWithLegacy(context, modernMetrics);
  });

  test('tab order reaches canvas toolbar before footer KPIs', async ({ page }) => {
    await fillCommonInputs(page);
    await page.locator('body').click();
    let focusedTruck = false;
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.id ?? '');
      if (id === 'truckType') {
        focusedTruck = true;
        break;
      }
    }
    expect(focusedTruck).toBeTruthy();

    let focusedToolbar = false;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
      if (label === 'Zoom out' || label === 'Zoom in' || label === 'Ansicht zurücksetzen') {
        focusedToolbar = true;
        break;
      }
    }
    expect(focusedToolbar).toBeTruthy();
  });

  test('stacked pallets render with pattern background', async ({ page }) => {
    await fillCommonInputs(page);
    // ensure we have at least two EUP and enable stacking
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(2).fill('2');
    await numberInputs.nth(3).fill('300');
    await page.locator('section').filter({ has: page.getByRole('heading', { name: 'Europaletten (EUP)' }) }).getByText('Stapelbar (2-fach)').click();
    await page.waitForTimeout(300);
    const euroTiles = page.locator('[aria-label*="Euro Palette"]');
    expect(await euroTiles.count()).toBeGreaterThanOrEqual(2);
    const pattern = await euroTiles.first().evaluate(node => getComputedStyle(node).backgroundImage);
    expect(pattern).toContain('repeating-linear-gradient');
  });
});
