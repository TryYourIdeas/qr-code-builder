import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'

async function decodeDownloadedPng(page: Page): Promise<string | undefined> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PNG' }).click(),
  ])
  const png = PNG.sync.read(readFileSync((await download.path())!))
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('downloads are disabled until the input is valid', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeDisabled()
  await page.getByRole('textbox', { name: 'URL', exact: true }).fill('example.com')
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled()
})

test('URL round-trips through the downloaded PNG', async ({ page }) => {
  await page.getByRole('textbox', { name: 'URL', exact: true }).fill('https://example.com/hello?x=1')
  await expect(page.getByTestId('qr-preview').locator('img')).toBeVisible()
  expect(await decodeDownloadedPng(page)).toBe('https://example.com/hello?x=1')
})

test('phone number round-trips as a tel: link', async ({ page }) => {
  await page.getByRole('tab', { name: 'Phone' }).click()
  await page.getByRole('textbox', { name: 'Phone number', exact: true }).fill('+1 (555) 010-9999')
  await expect(page.getByTestId('qr-preview').locator('img')).toBeVisible()
  expect(await decodeDownloadedPng(page)).toBe('tel:+15550109999')
})

test('invalid phone shows an error and keeps downloads disabled', async ({ page }) => {
  await page.getByRole('tab', { name: 'Phone' }).click()
  const phone = page.getByRole('textbox', { name: 'Phone number', exact: true })
  await phone.fill('555-CALL')
  await phone.blur()
  await expect(page.getByText(/valid phone number/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeDisabled()
})

test('SVG download produces an svg file', async ({ page }) => {
  await page.getByRole('textbox', { name: 'URL', exact: true }).fill('example.com')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download SVG' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.svg$/)
})

test('too-long content shows a message and disables downloads', async ({ page }) => {
  await page.getByRole('tab', { name: 'Text' }).click()
  await page.getByRole('textbox', { name: 'Text', exact: true }).fill('x'.repeat(5000))
  await expect(page.getByRole('alert')).toContainText(/too long/i)
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeDisabled()
})

test('inverted colors show a scan warning', async ({ page }) => {
  await page.getByLabel('Foreground color').fill('#ffffff')
  await page.getByLabel('Background color').fill('#000000')
  await expect(page.getByRole('status')).toContainText(/inverted|low contrast/i)
})
