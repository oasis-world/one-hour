/**
 * Downscale a user-picked / camera photo into a chat-friendly JPEG: long
 * edge capped, quality 0.82 — typically 100–300 KB, quick to upload and
 * light as a background image. Needs a real canvas, browser only.
 */

const MAX_EDGE = 1440

/** iPhone 高效格式 — 系统相册常以此交付，浏览器解码器大都不支持。 */
export function looksLikeHeic(file: File | Blob): boolean {
  const type = 'type' in file ? file.type : ''
  if (type === 'image/heic' || type === 'image/heif') return true
  const name = 'name' in file ? file.name : ''
  return /\.hei[cf]$/i.test(name)
}

/**
 * Decode with createImageBitmap, falling back to an <img> element: some
 * phone-gallery outputs are rejected by the bitmap API but still load in
 * an image element (and vice versa), so try both before giving up.
 */
async function decodeToBitmap(file: File | Blob): Promise<ImageBitmap> {
  // HEIC/HEIF from phone galleries: no browser decodes it natively, so
  // convert to JPEG first. Dynamic import — only HEIC picks pay for the
  // decoder chunk; everyone else stays on the lean path below.
  if (looksLikeHeic(file)) {
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
    const jpeg = Array.isArray(converted) ? converted[0] : converted
    return decodeNative(jpeg)
  }
  return decodeNative(file)
}

async function decodeNative(file: File | Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('img decode failed'))
        el.src = url
      })
      return await createImageBitmap(img)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export async function fileToChatImage(file: File | Blob): Promise<Blob> {
  const bitmap = await decodeToBitmap(file)
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
