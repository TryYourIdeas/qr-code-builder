import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'

const fixture = (name: string) => `tests/e2e/fixtures/${name}`

async function download(page: Page, name: 'Download PNG' | 'Download SVG') {
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()])
  return (await d.path())!
}
async function decodePng(page: Page): Promise<string | undefined> {
  const png = PNG.sync.read(readFileSync(await download(page, 'Download PNG')))
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data
}
const fillUrl = (page: Page, value: string) => page.getByRole('textbox', { name: 'URL', exact: true }).fill(value)
const preview = (page: Page) => page.getByTestId('qr-preview').locator('img')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('bundled dot and eye shapes still round-trip', async ({ page }) => {
  await fillUrl(page, 'https://example.com/shapes')
  await page.getByLabel('Dot shape', { exact: true }).selectOption('dots')
  await page.getByLabel('Eye shape', { exact: true }).selectOption('rounded')
  await expect(preview(page)).toBeVisible()
  expect(await decodePng(page)).toBe('https://example.com/shapes')
})

test('accented and emoji text round-trips as UTF-8', async ({ page }) => {
  await page.getByRole('tab', { name: 'Text' }).click()
  const text = 'héllo ñandú 🌍'
  await page.getByRole('textbox', { name: 'Text', exact: true }).fill(text)
  await expect(preview(page)).toBeVisible()
  expect(await decodePng(page)).toBe(text)
})

test('custom eye is rotated 0, -90 and 90 and the code still scans', async ({ page }) => {
  await fillUrl(page, 'https://example.com/eye')
  await page.getByLabel('Custom eye (SVG)').setInputFiles(fixture('eye.svg'))
  await expect(page.getByRole('img', { name: 'Custom eye preview' })).toBeVisible()
  await expect(preview(page)).toBeVisible()

  const svg = readFileSync(await download(page, 'Download SVG'), 'utf8')
  expect(svg).toMatch(/rotate\(0 /)
  expect(svg).toMatch(/rotate\(-90 /)
  expect(svg).toMatch(/rotate\(90 /)
  expect(svg).toContain('#4a148c')
  expect(await decodePng(page)).toBe('https://example.com/eye')
  // the scan check runs ~300 ms after each render; wait it out before asserting no warning
  await page.waitForTimeout(1000)
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('custom dot and custom eye together still scan', async ({ page }) => {
  await fillUrl(page, 'https://example.com/both')
  await page.getByLabel('Custom dot (SVG)').setInputFiles(fixture('dot.svg'))
  await page.getByLabel('Custom eye (SVG)').setInputFiles(fixture('eye.svg'))
  await expect(preview(page)).toBeVisible()
  expect(await decodePng(page)).toBe('https://example.com/both')
})

test('an eye that breaks the finder pattern shows the scan warning but stays downloadable', async ({ page }) => {
  await fillUrl(page, 'https://example.com/bad')
  await page.getByLabel('Custom eye (SVG)').setInputFiles(fixture('bad-eye.svg'))
  await expect(page.getByRole('status')).toContainText(/may not scan reliably/i)
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled()
})

test('a malicious svg is neutralized in the preview, the download, and when opened standalone', async ({ page, context }) => {
  let dialogSeen = false
  context.on('page', (p) => p.on('dialog', (d) => { dialogSeen = true; void d.dismiss() }))
  page.on('dialog', (d) => { dialogSeen = true; void d.dismiss() })

  await fillUrl(page, 'https://example.com/safe')
  await page.getByLabel('Custom eye (SVG)').setInputFiles(fixture('malicious.svg'))
  await expect(preview(page)).toBeVisible()

  const path = await download(page, 'Download SVG')
  const svg = readFileSync(path, 'utf8')
  expect(svg).not.toMatch(/<script|onload|onclick|evil\.example|foreignobject/i)

  // Standalone SVG files can run scripts when opened directly; nothing may fire.
  await page.goto(`file://${path}`)
  await page.waitForTimeout(500)
  expect(dialogSeen).toBe(false)
})

test('a non-svg upload is rejected visibly and the shape stays bundled', async ({ page }) => {
  await fillUrl(page, 'https://example.com/x')
  await page.getByLabel('Custom eye (SVG)').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') })
  await expect(page.getByRole('alert')).toContainText(/choose an SVG/i)
  await expect(page.getByLabel('Eye shape', { exact: true })).toHaveValue('square')
})

test('a dense code with custom tiles still renders', async ({ page }) => {
  await page.getByRole('tab', { name: 'Text' }).click()
  await page.getByRole('textbox', { name: 'Text', exact: true }).fill('0123456789 '.repeat(120))
  await page.getByLabel('Custom dot (SVG)').setInputFiles(fixture('dot.svg'))
  await expect(preview(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled()
})
