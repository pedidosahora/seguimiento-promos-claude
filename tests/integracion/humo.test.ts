import { afterAll, describe, expect, it } from 'vitest'
import { admin, clienteComo, crearUsuario, resetDatos } from './ayuda'

describe('humo (integración)', () => {
  afterAll(resetDatos)

  it('listUsers no devuelve error', async () => {
    const { error } = await admin().auth.admin.listUsers()
    expect(error).toBeNull()
  })

  it('crearUsuario y clienteComo funcionan', async () => {
    const { userId } = await crearUsuario({ email: 'humo@pro.agency', nombre: 'Humo', rol: 'admin' })
    expect(userId).toBeTruthy()
    const cliente = await clienteComo('humo@pro.agency')
    const { data } = await cliente.auth.getUser()
    expect(data.user?.id).toBe(userId)
  })
})
