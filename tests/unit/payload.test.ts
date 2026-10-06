import { buildPayload, normalizePhone, normalizeUrl } from '~/utils/payload'

describe('normalizers', () => {
  it('adds https:// when the scheme is missing', () => {
    expect(normalizeUrl(' example.com/a ')).toBe('https://example.com/a')
    expect(normalizeUrl('http://example.com')).toBe('http://example.com')
  })
  it('keeps a leading + and strips formatting from phones', () => {
    expect(normalizePhone('+1 (555) 010-9999')).toBe('+15550109999')
    expect(normalizePhone('555.010.9999')).toBe('5550109999')
  })
})

describe('buildPayload', () => {
  it('url', () => {
    expect(buildPayload({ type: 'url', url: 'example.com' })).toBe('https://example.com')
  })
  it('phone uses tel:', () => {
    expect(buildPayload({ type: 'phone', phone: '+1 555 010 9999' })).toBe('tel:+15550109999')
  })
  it('email with subject and body is URL-encoded', () => {
    expect(buildPayload({ type: 'email', address: 'a@b.co', subject: 'Hi there', body: 'x&y' }))
      .toBe('mailto:a@b.co?subject=Hi%20there&body=x%26y')
    expect(buildPayload({ type: 'email', address: 'a@b.co' })).toBe('mailto:a@b.co')
  })
  it('sms', () => {
    expect(buildPayload({ type: 'sms', phone: '555 0100', message: 'hello' })).toBe('SMSTO:5550100:hello')
    expect(buildPayload({ type: 'sms', phone: '555 0100' })).toBe('SMSTO:5550100:')
  })
  it('text is passed through untouched, including unicode', () => {
    expect(buildPayload({ type: 'text', text: 'héllo 🌍' })).toBe('héllo 🌍')
  })
  it('wifi WPA', () => {
    expect(buildPayload({ type: 'wifi', ssid: 'home', password: 'secret', security: 'WPA' }))
      .toBe('WIFI:T:WPA;S:home;P:secret;;')
  })
  it('wifi open network has no password and hidden flag when set', () => {
    expect(buildPayload({ type: 'wifi', ssid: 'cafe', security: 'nopass', hidden: true }))
      .toBe('WIFI:T:nopass;S:cafe;H:true;;')
  })
  it('wifi escapes special characters in ssid and password', () => {
    expect(buildPayload({ type: 'wifi', ssid: 'a;b,c:d', password: 'p"w\\x', security: 'WPA' }))
      .toBe('WIFI:T:WPA;S:a\\;b\\,c\\:d;P:p\\"w\\\\x;;')
  })
  it('vcard builds v3.0 card with only provided fields', () => {
    const v = buildPayload({ type: 'vcard', firstName: 'Ada', lastName: 'Lovelace', phone: '+123', email: 'ada@x.org' })
    expect(v).toBe([
      'BEGIN:VCARD', 'VERSION:3.0', 'N:Lovelace;Ada;;;', 'FN:Ada Lovelace',
      'TEL:+123', 'EMAIL:ada@x.org', 'END:VCARD',
    ].join('\n'))
  })
  it('vcard escapes commas, semicolons, backslashes and newlines', () => {
    const v = buildPayload({ type: 'vcard', firstName: 'A,B;C', org: 'x\\y\nz' })
    expect(v).toContain('N:;A\\,B\\;C;;;')
    expect(v).toContain('ORG:x\\\\y\\nz')
    expect(v.split('\n')).not.toContain('z')
  })
})
