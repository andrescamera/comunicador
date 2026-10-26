/** Recorta al centro en cuadrado y reduce a `size` px (JPEG): las fotos ocupan poco y cargan rápido */
export async function squareJpeg(file: Blob, size = 600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const out = Math.min(size, side)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = out
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo preparar la foto'))), 'image/jpeg', quality))
}
