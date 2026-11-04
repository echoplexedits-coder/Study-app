// Uploads are checked by their bytes, not by the content-type the client sends.
// The type header is only a hint: a browser can be told to send any string, so
// a .html document claiming to be a PNG has to be refused before it reaches R2.

const ZIP = [0x50, 0x4b, 0x03, 0x04]
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((byte, index) => bytes[index] === byte)

function text(bytes: Uint8Array, start: number, end: number): string {
  let out = ''
  for (let i = start; i < end && i < bytes.length; i++) out += String.fromCharCode(bytes[i])
  return out
}

/**
 * True when the first bytes of the file match the claimed type. Text formats
 * have no signature, so they are accepted only when the head has no NUL byte,
 * which rules out binary data posing as text.
 */
export function signatureOk(type: string, head: Uint8Array): boolean {
  switch (type) {
    case 'image/png':
      return startsWith(head, PNG)
    case 'image/jpeg':
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
    case 'image/gif':
      return text(head, 0, 4) === 'GIF8'
    case 'image/webp':
      return text(head, 0, 4) === 'RIFF' && text(head, 8, 12) === 'WEBP'
    case 'application/pdf':
      return text(head, 0, 5) === '%PDF-'
    case 'application/msword':
    case 'application/vnd.ms-powerpoint':
    case 'application/vnd.ms-excel':
      return startsWith(head, OLE)
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/epub+zip':
      return startsWith(head, ZIP)
    case 'application/rtf':
      return text(head, 0, 5) === '{\\rtf'
    case 'text/plain':
    case 'text/csv':
    case 'text/markdown':
      return head.length > 0 && !head.includes(0)
    default:
      return false
  }
}

/**
 * Reads the first few bytes of a streamed request without buffering the body.
 * The head is returned for inspection and a replacement stream carries the
 * same bytes onward, so a 90 MB upload still streams straight into R2.
 */
export async function peekBody(request: Request, size = 16): Promise<{ head: Uint8Array; body: ReadableStream<Uint8Array> }> {
  const source = request.body
  if (!source) return { head: new Uint8Array(), body: new ReadableStream<Uint8Array>({ start: (controller) => controller.close() }) }
  const reader = source.getReader()
  const first = await reader.read()
  const chunk = first.value ?? new Uint8Array()
  const head = chunk.slice(0, size)
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (chunk.byteLength) controller.enqueue(chunk)
      if (first.done) controller.close()
    },
    async pull(controller) {
      const next = await reader.read()
      if (next.done) controller.close()
      else controller.enqueue(next.value)
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })
  return { head, body }
}
