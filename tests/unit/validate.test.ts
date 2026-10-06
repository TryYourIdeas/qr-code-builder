import { validateInput } from '~/utils/validate'

describe('validateInput', () => {
  it('accepts valid urls with or without scheme', () => {
    expect(validateInput({ type: 'url', url: 'example.com' })).toEqual({})
    expect(validateInput({ type: 'url', url: 'https://example.com/a?b=1' })).toEqual({})
    expect(validateInput({ type: 'url', url: 'http://localhost:3000' })).toEqual({})
  })
  it('rejects empty, spaced or host-less urls', () => {
    expect(validateInput({ type: 'url', url: '  ' })).toHaveProperty('url')
    expect(validateInput({ type: 'url', url: 'exa mple.com' })).toHaveProperty('url')
    expect(validateInput({ type: 'url', url: 'notaurl' })).toHaveProperty('url')
  })
  it('accepts formatted phone numbers', () => {
    expect(validateInput({ type: 'phone', phone: '+1 (555) 010-9999' })).toEqual({})
  })
  it('rejects phones with letters, too few digits or empty', () => {
    expect(validateInput({ type: 'phone', phone: '555-CALL' })).toHaveProperty('phone')
    expect(validateInput({ type: 'phone', phone: '12' })).toHaveProperty('phone')
    expect(validateInput({ type: 'phone', phone: '' })).toHaveProperty('phone')
  })
  it('email requires a valid address', () => {
    expect(validateInput({ type: 'email', address: 'a@b.co' })).toEqual({})
    expect(validateInput({ type: 'email', address: 'a@b' })).toHaveProperty('address')
  })
  it('sms requires a valid phone', () => {
    expect(validateInput({ type: 'sms', phone: '555 0100' })).toEqual({})
    expect(validateInput({ type: 'sms', phone: 'abc' })).toHaveProperty('phone')
  })
  it('text must be non-empty', () => {
    expect(validateInput({ type: 'text', text: '' })).toHaveProperty('text')
    expect(validateInput({ type: 'text', text: 'hi' })).toEqual({})
  })
  it('wifi requires ssid, and password unless open', () => {
    expect(validateInput({ type: 'wifi', ssid: '', security: 'WPA', password: 'x' })).toHaveProperty('ssid')
    expect(validateInput({ type: 'wifi', ssid: 'a', security: 'WPA', password: '' })).toHaveProperty('password')
    expect(validateInput({ type: 'wifi', ssid: 'a', security: 'nopass' })).toEqual({})
  })
  it('vcard requires first name; validates optional email/phone', () => {
    expect(validateInput({ type: 'vcard', firstName: '' })).toHaveProperty('firstName')
    expect(validateInput({ type: 'vcard', firstName: 'Ada', email: 'bad' })).toHaveProperty('email')
    expect(validateInput({ type: 'vcard', firstName: 'Ada', phone: 'x1' })).toHaveProperty('phone')
    expect(validateInput({ type: 'vcard', firstName: 'Ada' })).toEqual({})
  })
})
