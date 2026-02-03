import { useSyncExternalStore } from 'react'

/**
 * Tailwind CSS breakpoints
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

type BreakpointKey = keyof typeof breakpoints

/**
 * Hook to check if viewport matches a media query
 * Uses useSyncExternalStore for proper SSR hydration
 * @param query - CSS media query string (e.g., "(min-width: 768px)")
 * @returns boolean indicating if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (callback: () => void): (() => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', callback)
    return () => mql.removeEventListener('change', callback)
  }

  const getSnapshot = (): boolean => window.matchMedia(query).matches

  // Return false during SSR to avoid hydration mismatch
  const getServerSnapshot = (): boolean => false

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Hook to check if viewport is at least the specified breakpoint
 * @param breakpoint - Tailwind breakpoint key (sm, md, lg, xl, 2xl)
 * @returns boolean indicating if viewport >= breakpoint
 */
export function useMinWidth(breakpoint: BreakpointKey): boolean {
  return useMediaQuery(`(min-width: ${breakpoints[breakpoint]}px)`)
}

/**
 * Hook to check if viewport is below the specified breakpoint
 * @param breakpoint - Tailwind breakpoint key (sm, md, lg, xl, 2xl)
 * @returns boolean indicating if viewport < breakpoint
 */
export function useMaxWidth(breakpoint: BreakpointKey): boolean {
  return useMediaQuery(`(max-width: ${breakpoints[breakpoint] - 1}px)`)
}

/**
 * Hook to check if user prefers reduced motion
 * @returns boolean indicating if reduced motion is preferred
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/**
 * Hook to check if user prefers dark color scheme
 * @returns boolean indicating if dark mode is preferred
 */
export function usePrefersDark(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)')
}
