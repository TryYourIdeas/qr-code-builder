import jsQR from 'jsqr'
import { svgToImageData } from '~/utils/qr/rasterize'

export async function scansBack(svg: string, expected: string, px = 400): Promise<boolean> {
  const image = await svgToImageData(svg, px)
  const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })
  return result?.data === expected
}
