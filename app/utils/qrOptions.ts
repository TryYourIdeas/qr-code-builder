import type { DotShape, EyeShape } from '~/utils/qr/shapes'
import type { SanitizedSvg } from '~/utils/qr/sanitizeSvg'

export type ErrorLevel = 'L' | 'M' | 'Q' | 'H'

export interface StyleState {
  fg: string
  bg: string
  dotShape: DotShape | 'custom'
  eyeShape: EyeShape | 'custom'
  customDot: SanitizedSvg | null
  customEye: SanitizedSvg | null
  size: number
  errorLevel: ErrorLevel
  logo: string | null
}

export const defaultStyle = (): StyleState => ({
  fg: '#000000',
  bg: '#ffffff',
  dotShape: 'square',
  eyeShape: 'square',
  customDot: null,
  customEye: null,
  size: 300,
  errorLevel: 'M',
  logo: null,
})
