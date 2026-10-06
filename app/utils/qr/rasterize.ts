const toDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not rasterize the SVG'))
    img.src = toDataUrl(svg)
  })
}

function draw(img: HTMLImageElement, px: number) {
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not available')
  ctx.drawImage(img, 0, 0, px, px)
  return { canvas, ctx }
}

export async function svgToImageData(svg: string, px: number): Promise<ImageData> {
  const { ctx } = draw(await loadImage(svg), px)
  return ctx.getImageData(0, 0, px, px)
}

export async function svgToPng(svg: string, px: number): Promise<Blob> {
  const { canvas } = draw(await loadImage(svg), px)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png'),
  )
}
