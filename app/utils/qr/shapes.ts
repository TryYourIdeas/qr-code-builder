export type DotShape = 'square' | 'dots' | 'rounded'
export type EyeShape = 'square' | 'rounded' | 'dot'

const HEX = /^#[0-9a-f]{6}$/i

export function safeColor(value: string, fallback: string): string {
  return HEX.test(value) ? value : fallback
}

export function dotMarkup(shape: DotShape, fill: string): string {
  switch (shape) {
    case 'square':
      return `<rect width="1" height="1" fill="${fill}"/>`
    case 'dots':
      return `<circle cx="0.5" cy="0.5" r="0.45" fill="${fill}"/>`
    case 'rounded':
      return `<rect width="1" height="1" rx="0.3" fill="${fill}"/>`
  }
}

export function eyeMarkup(shape: EyeShape, fill: string): string {
  switch (shape) {
    case 'square':
      return (
        `<path fill="${fill}" fill-rule="evenodd" d="M0 0h7v7H0zM1 1h5v5H1z"/>` +
        `<rect x="2" y="2" width="3" height="3" fill="${fill}"/>`
      )
    case 'rounded':
      return (
        `<rect x="0.5" y="0.5" width="6" height="6" rx="1.5" fill="none" stroke="${fill}" stroke-width="1"/>` +
        `<rect x="2" y="2" width="3" height="3" rx="0.8" fill="${fill}"/>`
      )
    case 'dot':
      return (
        `<circle cx="3.5" cy="3.5" r="3" fill="none" stroke="${fill}" stroke-width="1"/>` +
        `<circle cx="3.5" cy="3.5" r="1.5" fill="${fill}"/>`
      )
  }
}
