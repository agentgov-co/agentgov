import { useMaxWidth } from './use-media-query'

/**
 * Hook to check if viewport is mobile (< 768px)
 * @returns boolean indicating if on mobile device
 */
export function useIsMobile(): boolean {
  return useMaxWidth('md')
}

/**
 * Hook to check if viewport is tablet or smaller (< 1024px)
 * @returns boolean indicating if on tablet or smaller
 */
export function useIsTablet(): boolean {
  return useMaxWidth('lg')
}

/**
 * Hook to check if viewport is desktop (>= 1024px)
 * @returns boolean indicating if on desktop
 */
export function useIsDesktop(): boolean {
  return !useMaxWidth('lg')
}
