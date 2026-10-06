import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REQUIRED = ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy']

// nginx stops inheriting server-level add_header once a location declares its own,
// so every location that sets any header must repeat the security headers.
describe('nginx.conf', () => {
  const conf = readFileSync(resolve(process.cwd(), 'nginx.conf'), 'utf8')
  const locations = [...conf.matchAll(/location\s+\S+\s*\{([^}]*)\}/g)].map((m) => m[1]!)

  it('has locations to check', () => {
    expect(locations.length).toBeGreaterThan(0)
  })
  it.each(REQUIRED)('keeps %s on every location that sets its own add_header', (header) => {
    for (const body of locations.filter((b) => b.includes('add_header'))) {
      expect(body).toContain(header)
    }
  })
})
