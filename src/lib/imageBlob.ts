/**
 * Downscale a user-picked / camera photo into a chat-friendly JPEG: long
 * edge capped, quality 0.82 — typically 100–300 KB, quick to upload and
 * light as a background image. Needs a real canvas, browser only.
 */

const MAX_EDGE = 1440

export async function fileToChatImage(file: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas unavailable')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82),
    )
    if (!blob) throw new Error('canvas.toBlob failed')
    return blob
  } finally {
    bitmap.close()
  }
}
