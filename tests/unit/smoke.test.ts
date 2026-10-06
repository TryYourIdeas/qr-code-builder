describe('tooling', () => {
  it('resolves the ~ alias to app/', async () => {
    const mod = await import('~/app.vue')
    expect(mod.default).toBeDefined()
  })
})
