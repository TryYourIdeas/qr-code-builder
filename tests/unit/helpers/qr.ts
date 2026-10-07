import jsQR from 'jsqr'
import type { QrMatrix } from '~/utils/qr/matrix'

export function matrixToRgba(m: QrMatrix, scale = 8, quiet = 4) {
  const side = (m.size + quiet * 2) * scale
  const data = new Uint8ClampedArray(side * side * 4).fill(255)
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (!m.isDark(r, c)) continue
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const i = (((r + quiet) * scale + y) * side + (c + quiet) * scale + x) * 4
          data[i] = data[i + 1] = data[i + 2] = 0
        }
      }
    }
  }
  return { data, width: side, height: side }
}

export function decodeMatrix(m: QrMatrix): string | undefined {
  const { data, width, height } = matrixToRgba(m)
  return jsQR(data, width, height)?.data
}
