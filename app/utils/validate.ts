import { normalizePhone, normalizeUrl, type QrInput } from '~/utils/payload'

export type ValidationErrors = Record<string, string>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidPhone(raw: string): boolean {
  if (!/^[+\d\s().-]+$/.test(raw.trim())) return false
  return /^\+?\d{3,15}$/.test(normalizePhone(raw))
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
