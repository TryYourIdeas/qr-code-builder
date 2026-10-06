import { normalizePhone, normalizeUrl, type QrInput } from '~/utils/payload'

export type ValidationErrors = Record<string, string>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidPhone(raw: string): boolean {
  if (!/^[+\d\s().-]+$/.test(raw.trim())) return false
  return /^\+?\d{3,15}$/.test(normalizePhone(raw))
}

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):\/\//i
const HINT_SCHEMES: Record<string, string> = {
  mailto: 'Use the Email tab for mailto: links.',
  tel: 'Use the Phone tab for tel: links.',
  sms: 'Use the SMS tab for SMS links.',
  smsto: 'Use the SMS tab for SMS links.',
}

// Only http(s) links are encoded: other schemes (javascript:, data:, file:, ...) are unsafe to
// hand to people who scan the code, and mailto:/tel: would otherwise be mangled into https://mailto:...
function urlSchemeError(raw: string): string | null {
  const t = raw.trim()
  const withSlashes = SCHEME_RE.exec(t)
  if (withSlashes) {
    return /^https?$/i.test(withSlashes[1]!) ? null : 'Only http:// and https:// links are supported.'
  }
  const bare = /^(mailto|tel|sms|smsto|javascript|data|file|vbscript):/i.exec(t)
  if (bare) return HINT_SCHEMES[bare[1]!.toLowerCase()] ?? 'Only http:// and https:// links are supported.'
  return null
}

function isValidUrl(raw: string): boolean {
  const t = raw.trim()
  if (!t || /\s/.test(t)) return false
  try {
    const { hostname } = new URL(normalizeUrl(t))
    return hostname === 'localhost' || hostname.includes('.')
  } catch {
    return false
  }
}

export function validateInput(input: QrInput): ValidationErrors {
  const e: ValidationErrors = {}
  switch (input.type) {
    case 'url':
      if (!input.url.trim()) e.url = 'Enter a URL'
      else if (urlSchemeError(input.url)) e.url = urlSchemeError(input.url)!
      else if (!isValidUrl(input.url)) e.url = 'Enter a valid URL, e.g. example.com'
      break
    case 'phone':
    case 'sms':
      if (!input.phone.trim()) e.phone = 'Enter a phone number'
      else if (!isValidPhone(input.phone)) e.phone = 'Enter a valid phone number (digits, optional leading +)'
      break
    case 'email':
      if (!input.address.trim()) e.address = 'Enter an email address'
      else if (!EMAIL_RE.test(input.address.trim())) e.address = 'Enter a valid email address'
      break
    case 'text':
      if (!input.text.trim()) e.text = 'Enter some text'
      break
    case 'wifi':
      if (!input.ssid.trim()) e.ssid = 'Enter the network name'
      if (input.security !== 'nopass' && !(input.password ?? '').length) e.password = 'Enter the password'
      break
    case 'vcard':
      if (!input.firstName.trim()) e.firstName = 'Enter a first name'
      if (input.email?.trim() && !EMAIL_RE.test(input.email.trim())) e.email = 'Enter a valid email address'
      if (input.phone?.trim() && !isValidPhone(input.phone)) e.phone = 'Enter a valid phone number'
      break
  }
  return e
}
