import type { ContentType } from '~/utils/payload'

export type FieldValues = Record<string, string | boolean>

export interface FieldDef {
  key: string
  label: string
  kind: 'text' | 'url' | 'tel' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox'
  required?: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
  hiddenWhen?: { key: string; equals: string }
}

export const TYPES: { value: ContentType; label: string }[] = [
  { value: 'url', label: 'URL' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'text', label: 'Text' },
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'vcard', label: 'Contact' },
]

export const FIELD_DEFS: Record<ContentType, FieldDef[]> = {
  url: [{ key: 'url', label: 'URL', kind: 'url', required: true, placeholder: 'example.com' }],
  phone: [{ key: 'phone', label: 'Phone number', kind: 'tel', required: true, placeholder: '+1 555 010 9999' }],
  email: [
    { key: 'address', label: 'Email address', kind: 'email', required: true },
    { key: 'subject', label: 'Subject', kind: 'text' },
    { key: 'body', label: 'Message', kind: 'textarea' },
  ],
  sms: [
    { key: 'phone', label: 'Phone number', kind: 'tel', required: true },
    { key: 'message', label: 'Message', kind: 'textarea' },
  ],
  text: [{ key: 'text', label: 'Text', kind: 'textarea', required: true }],
  wifi: [
    { key: 'ssid', label: 'Network name', kind: 'text', required: true },
    {
      key: 'security',
      label: 'Security',
      kind: 'select',
      options: [
        { value: 'WPA', label: 'WPA/WPA2/WPA3' },
        { value: 'WEP', label: 'WEP' },
        { value: 'nopass', label: 'None (open network)' },
      ],
    },
    { key: 'password', label: 'Password', kind: 'password', required: true, hiddenWhen: { key: 'security', equals: 'nopass' } },
    { key: 'hidden', label: 'Hidden network', kind: 'checkbox' },
  ],
  vcard: [
    { key: 'firstName', label: 'First name', kind: 'text', required: true },
    { key: 'lastName', label: 'Last name', kind: 'text' },
    { key: 'org', label: 'Organization', kind: 'text' },
    { key: 'phone', label: 'Phone', kind: 'tel' },
    { key: 'email', label: 'Email', kind: 'email' },
    { key: 'url', label: 'Website', kind: 'url' },
  ],
}

export function defaultFields(type: ContentType): FieldValues {
  const out: FieldValues = {}
  for (const f of FIELD_DEFS[type]) {
    out[f.key] = f.kind === 'checkbox' ? false : f.kind === 'select' ? f.options![0]!.value : ''
  }
  return out
}
