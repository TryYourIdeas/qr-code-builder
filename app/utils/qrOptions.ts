import type { Options } from 'qr-code-styling'

export type DotStyle = 'square' | 'dots' | 'rounded' | 'extra-rounded' | 'classy' | 'classy-rounded'
export type CornerStyle = 'square' | 'rounded' | 'dot'
export type ErrorLevel = 'L' | 'M' | 'Q' | 'H'

export interface StyleState {
  fg: string
  bg: string
  dotStyle: DotStyle
  cornerStyle: CornerStyle
  size: number
  errorLevel: ErrorLevel
  logo: string | null
}

export const defaultStyle = (): StyleState => ({
  fg: '#000000',
  bg: '#ffffff',
  dotStyle: 'square',
  cornerStyle: 'square',
  size: 300,
  errorLevel: 'M',
  logo: null,
})

const CORNERS = {
  square: { square: 'square', dot: 'square' },
  rounded: { square: 'extra-rounded', dot: 'dot' },
  dot: { square: 'dot', dot: 'dot' },
} as const

export function buildQrOptions(style: StyleState, data: string): Options {
  const c = CORNERS[style.cornerStyle]
  return {
    width: style.size,
    height: style.size,
    type: 'canvas',
    data,
    image: style.logo ?? undefined,
    margin: 10,
    qrOptions: { errorCorrectionLevel: style.logo ? 'H' : style.errorLevel },
    dotsOptions: { color: style.fg, type: style.dotStyle },
    cornersSquareOptions: { color: style.fg, type: c.square },
    cornersDotOptions: { color: style.fg, type: c.dot },
    backgroundOptions: { color: style.bg },
    imageOptions: { crossOrigin: 'anonymous', margin: 4, imageSize: 0.3 },
  }
}
