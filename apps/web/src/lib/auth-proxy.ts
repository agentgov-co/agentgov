/** Headers allowed to be forwarded from client to API backend */
export const ALLOWED_HEADERS = ['content-type', 'cookie', 'accept', 'accept-language', 'user-agent', 'origin', 'referer', 'x-csrf-token']

/** Filter incoming request headers through the whitelist and set X-Forwarded-For (first IP only) */
export function filterHeaders(incomingHeaders: { get(name: string): string | null }): Headers {
  const headers = new Headers()

  for (const name of ALLOWED_HEADERS) {
    const value = incomingHeaders.get(name)
    if (value) headers.set(name, value)
  }

  // Add forwarded IP — takes only the first IP to prevent spoofing
  const ip = incomingHeaders.get('x-forwarded-for') || '127.0.0.1'
  headers.set('X-Forwarded-For', ip.split(',')[0].trim())

  return headers
}
