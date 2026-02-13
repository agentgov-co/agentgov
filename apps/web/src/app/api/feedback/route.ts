import { NextRequest, NextResponse } from 'next/server'
import { filterHeaders } from '@/lib/auth-proxy'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const targetUrl = `${API_URL}/v1/feedback`

  // Use same header filtering as auth proxy to properly forward cookies
  const headers = filterHeaders(request.headers)

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: await request.text(),
    })

    const responseHeaders = new Headers()
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-encoding' &&
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
  } catch (error) {
    console.error('[Feedback Proxy] Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}
