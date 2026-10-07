import qrcode from 'qrcode-generator'
import type { ErrorLevel } from '~/utils/qrOptions'

// The library's default encoder is ISO-8859-1, which corrupts accents and emoji.
const utf8 = new TextEncoder()
qrcode.stringToBytes = (s: string) => Array.from(utf8.encode(s))

export class QrCapacityError extends Error {
  constructor() {
    super('Content does not fit in a QR code')
    this.name = 'QrCapacityError'
  }
}

export interface QrMatrix {
  size: number
  isDark(row: number, col: number): boolean
}

export function buildMatrix(text: string, level: ErrorLevel): QrMatrix {
  const qr = qrcode(0, level)
  qr.addData(text, 'Byte')
  try {
    qr.make()
  } catch {
    throw new QrCapacityError()
  }
  return { size: qr.getModuleCount(), isDark: (row, col) => qr.isDark(row, col) }
}
