import { debugLog, setDebug } from '~/utils/log'

describe('debugLog', () => {
  afterEach(() => vi.restoreAllMocks())
  it('is silent by default and logs once enabled', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    setDebug(false)
    debugLog('hidden')
    expect(spy).not.toHaveBeenCalled()
    setDebug(true)
    debugLog('shown', { a: 1 })
    expect(spy).toHaveBeenCalledWith('[qr-code-builder]', 'shown', { a: 1 })
  })
})
