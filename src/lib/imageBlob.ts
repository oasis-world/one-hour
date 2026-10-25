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

const AVATAR_EDGE = 256

/** Center-crop to a square, cap at 256px — avatar-friendly, a few KB. */
export async function fileToAvatarImage(file: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const scale = Math.min(1, AVATAR_EDGE / side)
    const out = Math.max(1, Math.round(side * scale))
    const sx = (bitmap.width - side) / 2
    const sy = (bitmap.height - side) / 2

    const canvas = document.createElement('canvas')
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas unavailable')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.86),
    )
    if (!blob) throw new Error('canvas.toBlob failed')
    return blob
  } finally {
    bitmap.close()
  }
}
