/**
 * compressFile — Client-side file optimization before Supabase storage upload.
 * - Images (JPEG/PNG/GIF/WebP): compressed via Canvas API to 80% quality
 * - All files: blocked if > 10MB
 * Returns the optimized File/Blob, or throws with a user-friendly message.
 */
export const MAX_FILE_MB = 10
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

export async function compressFile(file: File): Promise<File | Blob> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`"${file.name}" exceeds the ${MAX_FILE_MB}MB limit. Please reduce the file size and try again.`)
  }

  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!imageTypes.includes(file.type)) {
    // Non-image — return as-is
    return file
  }

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)

      // Scale down if very large (max 2400px on longest side)
      const maxPx = 2400
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        const ratio = Math.min(maxPx / width, maxPx / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(file) // fallback
      ctx.drawImage(img, 0, 0, width, height)

      // Output as JPEG at 80% — excellent compression, minimal quality loss
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file) // fallback if canvas fails
          resolve(blob)
        },
        'image/jpeg',
        0.80
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // fallback — upload original if image fails to load
    }
    img.src = url
  })
}
