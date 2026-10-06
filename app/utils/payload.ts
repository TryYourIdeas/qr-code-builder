export type ContentType = 'url' | 'phone' | 'email' | 'sms' | 'text' | 'wifi' | 'vcard'

export type QrInput =
  | { type: 'url'; url: string }
  | { type: 'phone'; phone: string }
  | { type: 'email'; address: string; subject?: string; body?: string }
  | { type: 'sms'; phone: string; message?: string }
  | { type: 'text'; text: string }
  | { type: 'wifi'; ssid: string; password?: string; security: 'WPA' | 'WEP' | 'nopass'; hidden?: boolean }
  | {
      type: 'vcard'
      firstName: string
      lastName?: string
      phone?: string
      email?: string
      org?: string
      url?: string
    }

export function normalizeUrl(raw: string): string {
  const t = raw.trim()
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`
}

export function normalizePhone(raw: string): string {
  const t = raw.trim()
  return (t.startsWith('+') ? '+' : '') + t.replace(/\D/g, '')
}

const escapeWifi = (s: string) => s.replace(/([\\;,:"])/g, '\\$1')
const escapeVcard = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([;,])/g, '\\$1')

export function buildPayload(input: QrInput): string {
  switch (input.type) {
    case 'url':
      return normalizeUrl(input.url)
    case 'phone':
      return `tel:${normalizePhone(input.phone)}`
    case 'email': {
      const q: string[] = []
      if (input.subject) q.push(`subject=${encodeURIComponent(input.subject)}`)
      if (input.body) q.push(`body=${encodeURIComponent(input.body)}`)
      return `mailto:${input.address.trim()}${q.length ? '?' + q.join('&') : ''}`
    }
    case 'sms':
      return `SMSTO:${normalizePhone(input.phone)}:${input.message ?? ''}`
    case 'text':
      return input.text
    case 'wifi': {
      const parts = [`T:${input.security}`, `S:${escapeWifi(input.ssid)}`]
      if (input.security !== 'nopass') parts.push(`P:${escapeWifi(input.password ?? '')}`)
      if (input.hidden) parts.push('H:true')
      return `WIFI:${parts.join(';')};;`
    }
    case 'vcard': {
      const first = input.firstName.trim()
      const last = (input.lastName ?? '').trim()
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${escapeVcard(last)};${escapeVcard(first)};;;`,
        `FN:${escapeVcard(`${first} ${last}`.trim())}`,
      ]
      if (input.org) lines.push(`ORG:${escapeVcard(input.org)}`)
      if (input.phone) lines.push(`TEL:${escapeVcard(input.phone.trim())}`)
      if (input.email) lines.push(`EMAIL:${escapeVcard(input.email.trim())}`)
      if (input.url) lines.push(`URL:${escapeVcard(input.url.trim())}`)
      lines.push('END:VCARD')
      return lines.join('\n')
    }
  }
}
