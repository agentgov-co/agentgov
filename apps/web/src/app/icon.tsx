import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon(): ImageResponse {
  return new ImageResponse(
    (
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Trace Flow logo */}
        <circle cx="6" cy="16" r="4" fill="#7C3AED" />
        <circle cx="16" cy="6" r="4" fill="#7C3AED" />
        <circle cx="26" cy="20" r="4" fill="#7C3AED" />

        {/* Connecting lines */}
        <path
          d="M9.5 13.5L13 9M19 8L23 17"
          stroke="#7C3AED"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Small accent dot */}
        <circle cx="16" cy="26" r="2.5" fill="#7C3AED" opacity="0.4" />
        <path
          d="M14.5 24L8.5 18.5"
          stroke="#7C3AED"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.4"
        />
      </svg>
    ),
    {
      ...size,
    }
  )
}
