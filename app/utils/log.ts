let enabled = false

export function setDebug(value: boolean): void {
  enabled = value
}

export function debugLog(message: string, data?: unknown): void {
  if (!enabled) return
  if (data === undefined) console.debug('[qr-code-builder]', message)
  else console.debug('[qr-code-builder]', message, data)
}
