/**
 * IP address utility functions for API key IP whitelist.
 * IPv4 only for now.
 */

/**
 * Convert an IPv4 address string to a 32-bit integer.
 * Returns null for invalid addresses.
 */
export function ipToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null

  let result = 0
  for (const part of parts) {
    const octet = parseInt(part, 10)
    if (isNaN(octet) || octet < 0 || octet > 255) return null
    result = (result << 8) + octet
  }

  // Convert to unsigned 32-bit integer
  return result >>> 0
}

/**
 * Check if an IP address falls within a CIDR range.
 * Example: isIpInCidr('192.168.1.5', '192.168.1.0/24') => true
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  const [network, prefixStr] = cidr.split('/')
  if (!network || !prefixStr) return false

  const prefix = parseInt(prefixStr, 10)
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false

  const ipInt = ipToInt(ip)
  const networkInt = ipToInt(network)

  if (ipInt === null || networkInt === null) return false

  // Create mask: e.g., prefix=24 => 0xFFFFFF00
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0

  return (ipInt & mask) === (networkInt & mask)
}

/**
 * Normalize an IP address by stripping IPv4-mapped IPv6 prefix.
 * e.g., "::ffff:192.168.1.1" => "192.168.1.1"
 */
function normalizeIp(ip: string): string {
  if (ip.startsWith('::ffff:')) {
    return ip.slice(7)
  }
  return ip
}

/**
 * Check if a client IP is allowed against a list of allowed IPs/CIDRs.
 * Returns true if:
 * - allowedIps is empty (no restriction)
 * - clientIp matches any entry (exact match or CIDR match)
 */
export function isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
  // Empty list = no restriction
  if (allowedIps.length === 0) return true

  const normalized = normalizeIp(clientIp)

  for (const entry of allowedIps) {
    if (entry.includes('/')) {
      // CIDR notation
      if (isIpInCidr(normalized, entry)) return true
    } else {
      // Exact match
      if (normalized === normalizeIp(entry)) return true
    }
  }

  return false
}
