const LOW = 'Low contrast: this code may not scan reliably. Use a darker foreground on a lighter background.'
const INVERTED = 'Light-on-dark (inverted) codes are not read by some scanners. Prefer a dark foreground on a light background.'

function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1]!, 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return null
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

export function contrastWarning(fg: string, bg: string): string | null {
  const ratio = contrastRatio(fg, bg)
  if (ratio === null) return null
  if (ratio < 3) return LOW
  if (luminance(fg)! > luminance(bg)!) return INVERTED
  return null
}
