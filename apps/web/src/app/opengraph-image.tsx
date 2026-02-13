import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'AgentGov - AI Agent Governance Platform'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function Image(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'linear-gradient(to bottom right, #0a0a0a, #1a1a2e)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 'bold',
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}
          >
            AgentGov
          </span>
        </div>
        <div
          style={{
            fontSize: 36,
            color: '#a0a0a0',
            marginBottom: 16,
          }}
        >
          AI Agent Governance Platform
        </div>
        <div
          style={{
            fontSize: 24,
            color: '#7c3aed',
          }}
        >
          Observability + EU AI Act Compliance
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
