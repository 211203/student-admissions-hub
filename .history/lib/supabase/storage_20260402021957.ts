export const STUDENT_DOCUMENTS_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'student-documents'

export function getStorageErrorMessage(error: unknown, bucketName = STUDENT_DOCUMENTS_BUCKET) {
  if (!(error instanceof Error)) {
    return 'Upload failed'
  }

  const message = error.message || ''
  const isBucketMissing =
    /bucket not found/i.test(message) ||
    /The resource was not found/i.test(message)

  if (isBucketMissing) {
    return `Storage bucket "${bucketName}" not found. Create this bucket in Supabase Storage or set NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET correctly.`
  }

  return message
}
