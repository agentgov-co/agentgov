import { NextRequest, NextResponse } from 'next/server'
import { filterHeaders } from '@/lib/auth-proxy'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function handler(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url)
  const targetUrl = `${API_URL}${url.pathname}${url.search}`

  // Whitelist headers to prevent leaking sensitive client headers to backend
  const headers = filterHeaders(request.headers)

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.text()
      : undefined,
    redirect: 'manual', // Don't follow redirects, return them
  })

  // Create response with all headers from API
  const responseHeaders = new Headers()

  // Copy all headers from API response
  response.headers.forEach((value, key) => {
    // Handle Set-Cookie specially - need to pass through
    if (key.toLowerCase() === 'set-cookie') {
      responseHeaders.append(key, value)
    } else if (key.toLowerCase() !== 'content-encoding' &&
               key.toLowerCase() !== 'transfer-encoding') {
      responseHeaders.set(key, value)
    }
  })

  // Handle redirects - rewrite API URLs to frontend URLs
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (location) {
      // If redirect is to API, rewrite to frontend
      const newLocation = location.replace(API_URL, url.origin)
      responseHeaders.set('location', newLocation)
    }
  }

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
