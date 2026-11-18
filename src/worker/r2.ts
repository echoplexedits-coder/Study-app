/**
 * Lists every object in the bucket, including page metadata. R2 truncates a
 * listing at 1,000 objects, so callers that need totals must walk the cursor.
 */
export async function listR2Objects(bucket: R2Bucket): Promise<R2Object[]> {
  const objects: R2Object[] = []
  let cursor: string | undefined
  while (true) {
    const result = cursor
      ? await bucket.list({ cursor, include: ['httpMetadata'] })
      : await bucket.list({ include: ['httpMetadata'] })
    objects.push(...result.objects)
    if (!result.truncated) break
    cursor = result.cursor
  }
  return objects
}
