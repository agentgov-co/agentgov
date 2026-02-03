import { describe, it, expect } from 'vitest'
import { ipToInt, isIpInCidr, isIpAllowed } from './ip-utils.js'

describe('ip-utils', () => {
  describe('ipToInt', () => {
    it('should convert 0.0.0.0 to 0', () => {
      expect(ipToInt('0.0.0.0')).toBe(0)
    })

    it('should convert 255.255.255.255 to max uint32', () => {
      expect(ipToInt('255.255.255.255')).toBe(4294967295)
    })

    it('should convert 192.168.1.1 correctly', () => {
      expect(ipToInt('192.168.1.1')).toBe(3232235777)
    })

    it('should convert 10.0.0.1 correctly', () => {
      expect(ipToInt('10.0.0.1')).toBe(167772161)
    })

    it('should return null for invalid IP', () => {
      expect(ipToInt('not-an-ip')).toBeNull()
    })

    it('should return null for too few octets', () => {
      expect(ipToInt('192.168.1')).toBeNull()
    })

    it('should return null for too many octets', () => {
      expect(ipToInt('192.168.1.1.1')).toBeNull()
    })

    it('should return null for octet > 255', () => {
      expect(ipToInt('256.0.0.0')).toBeNull()
    })

    it('should return null for negative octet', () => {
      expect(ipToInt('-1.0.0.0')).toBeNull()
    })

    it('should return null for non-numeric octet', () => {
      expect(ipToInt('abc.0.0.0')).toBeNull()
    })
  })

  describe('isIpInCidr', () => {
    it('should match IP in /24 range', () => {
      expect(isIpInCidr('192.168.1.100', '192.168.1.0/24')).toBe(true)
    })

    it('should not match IP outside /24 range', () => {
      expect(isIpInCidr('192.168.2.1', '192.168.1.0/24')).toBe(false)
    })

    it('should match IP in /16 range', () => {
      expect(isIpInCidr('10.0.255.1', '10.0.0.0/16')).toBe(true)
    })

    it('should not match IP outside /16 range', () => {
      expect(isIpInCidr('10.1.0.1', '10.0.0.0/16')).toBe(false)
    })

    it('should match /32 only for exact IP', () => {
      expect(isIpInCidr('192.168.1.1', '192.168.1.1/32')).toBe(true)
      expect(isIpInCidr('192.168.1.2', '192.168.1.1/32')).toBe(false)
    })

    it('should match /0 for any IP', () => {
      expect(isIpInCidr('1.2.3.4', '0.0.0.0/0')).toBe(true)
      expect(isIpInCidr('255.255.255.255', '0.0.0.0/0')).toBe(true)
    })

    it('should match /8 range', () => {
      expect(isIpInCidr('10.255.255.255', '10.0.0.0/8')).toBe(true)
      expect(isIpInCidr('11.0.0.0', '10.0.0.0/8')).toBe(false)
    })

    it('should return false for invalid CIDR notation', () => {
      expect(isIpInCidr('192.168.1.1', '192.168.1.0')).toBe(false)
    })

    it('should return false for invalid prefix length', () => {
      expect(isIpInCidr('192.168.1.1', '192.168.1.0/33')).toBe(false)
      expect(isIpInCidr('192.168.1.1', '192.168.1.0/-1')).toBe(false)
    })

    it('should return false for invalid IP in CIDR', () => {
      expect(isIpInCidr('192.168.1.1', 'invalid/24')).toBe(false)
    })

    it('should return false for invalid client IP', () => {
      expect(isIpInCidr('invalid', '192.168.1.0/24')).toBe(false)
    })
  })

  describe('isIpAllowed', () => {
    it('should allow any IP when allowedIps is empty', () => {
      expect(isIpAllowed('1.2.3.4', [])).toBe(true)
    })

    it('should allow exact IP match', () => {
      expect(isIpAllowed('192.168.1.1', ['192.168.1.1'])).toBe(true)
    })

    it('should reject non-matching IP', () => {
      expect(isIpAllowed('192.168.1.2', ['192.168.1.1'])).toBe(false)
    })

    it('should allow IP matching CIDR range', () => {
      expect(isIpAllowed('192.168.1.50', ['192.168.1.0/24'])).toBe(true)
    })

    it('should reject IP outside CIDR range', () => {
      expect(isIpAllowed('192.168.2.1', ['192.168.1.0/24'])).toBe(false)
    })

    it('should allow if any entry matches (exact)', () => {
      expect(isIpAllowed('10.0.0.1', ['192.168.1.1', '10.0.0.1'])).toBe(true)
    })

    it('should allow if any entry matches (CIDR)', () => {
      expect(isIpAllowed('10.0.0.5', ['192.168.1.0/24', '10.0.0.0/8'])).toBe(true)
    })

    it('should reject if no entry matches', () => {
      expect(isIpAllowed('172.16.0.1', ['192.168.1.1', '10.0.0.0/8'])).toBe(false)
    })

    it('should handle mixed exact and CIDR entries', () => {
      const allowedIps = ['192.168.1.1', '10.0.0.0/24', '172.16.0.5']
      expect(isIpAllowed('192.168.1.1', allowedIps)).toBe(true)
      expect(isIpAllowed('10.0.0.100', allowedIps)).toBe(true)
      expect(isIpAllowed('172.16.0.5', allowedIps)).toBe(true)
      expect(isIpAllowed('172.16.0.6', allowedIps)).toBe(false)
    })

    it('should normalize IPv4-mapped IPv6 addresses', () => {
      expect(isIpAllowed('::ffff:192.168.1.1', ['192.168.1.1'])).toBe(true)
    })

    it('should normalize IPv4-mapped IPv6 in allowedIps', () => {
      expect(isIpAllowed('192.168.1.1', ['::ffff:192.168.1.1'])).toBe(true)
    })

    it('should handle CIDR with IPv4-mapped IPv6 client', () => {
      expect(isIpAllowed('::ffff:10.0.0.5', ['10.0.0.0/24'])).toBe(true)
    })
  })
})
