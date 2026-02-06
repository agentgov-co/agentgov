import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

const ALLOWED_HEADERS = ['content-type', 'cookie', 'accept', 'accept-language', 'user-agent', 'x-csrf-token', 'origin', 'referer']

async function handler(request: NextRequest): Promise<NextResponse> {
  // Extract the proxied path from /api/proxy/...
  const url = new URL(request.url)
  const proxyPath = url.pathname.replace(/^\/api\/proxy/, '')
  const targetUrl = `${API_URL}${proxyPath}${url.search}`

  // Whitelist headers
  const headers = new Headers()
  for (const name of ALLOWED_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  // Add forwarded IP
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
  headers.set('X-Forwarded-For', ip.split(',')[0].trim())

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.text()
      : undefined,
  })

  const responseHeaders = new Headers()
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      responseHeaders.append(key, value)
    } else if (key.toLowerCase() !== 'content-encoding' &&
               key.toLowerCase() !== 'transfer-encoding') {
      responseHeaders.set(key, value)
    }
  })

  const body = response.status !== 204 ? await response.arrayBuffer() : null

  return new NextResponse(body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
