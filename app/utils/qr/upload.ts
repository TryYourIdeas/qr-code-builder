import { MAX_SVG_BYTES, sanitizeSvg, type SanitizeResult } from '~/utils/qr/sanitizeSvg'

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'))
    reader.readAsText(file)
  })
}

export async function loadSvgUpload(file: File, idPrefix: string): Promise<SanitizeResult> {
  if (file.type !== 'image/svg+xml' && !/\.svg$/i.test(file.name)) {
    return { ok: false, error: 'Please choose an SVG file.' }
  }
  if (file.size > MAX_SVG_BYTES) return { ok: false, error: 'SVG is larger than 200 KB.' }
  try {
    return sanitizeSvg(await readFileText(file), idPrefix)
  } catch (e) {
    console.error('[qr-code-builder] svg read failed', { name: file.name, size: file.size, type: file.type }, e)
    return { ok: false, error: 'Could not read the SVG file.' }
  }
}
