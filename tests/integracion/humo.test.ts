import { describe, expect, it } from 'vitest'
import { admin } from './ayuda'

describe('humo (integración)', () => {
  it('listUsers no devuelve error', async () => {
    const { error } = await admin().auth.admin.listUsers()
    expect(error).toBeNull()
  })
})
