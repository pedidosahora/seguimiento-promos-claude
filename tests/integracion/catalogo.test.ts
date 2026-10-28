import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { admin, clienteComo, crearUsuario, resetDatos } from './ayuda'

describe('catálogo y permisos base', () => {
  beforeEach(resetDatos)
  afterAll(resetDatos)

  it('admin crea concesión y kam la lee', async () => {
    await crearUsuario({ email: 'admin@pro.agency', nombre: 'Admin', rol: 'admin' })
    await crearUsuario({ email: 'kam@pro.agency', nombre: 'Kam', rol: 'kam' })
    const a = await clienteComo('admin@pro.agency')
    const { error } = await a.from('concesiones').insert({ id: 900, razon_social: 'PRUEBA S.L.' })
    expect(error).toBeNull()
    const k = await clienteComo('kam@pro.agency')
    const { data } = await k.from('concesiones').select('*')
    expect(data).toHaveLength(1)
  })

  it('kam no puede crear concesiones', async () => {
    await crearUsuario({ email: 'kam@pro.agency', nombre: 'Kam', rol: 'kam' })
    const k = await clienteComo('kam@pro.agency')
    const { data, error } = await k
      .from('concesiones')
      .insert({ id: 901, razon_social: 'NO S.L.' })
      .select()
    expect(error !== null || (data ?? []).length === 0).toBe(true)
    const { data: filas } = await admin().from('concesiones').select('id')
    expect(filas).toEqual([])
  })

  it('usuario sin perfil no ve nada', async () => {
    await admin().from('concesiones').insert({ id: 902, razon_social: 'X S.L.' })
    const { error: e } = await admin().auth.admin.createUser({
      email: 'sinperfil@pro.agency',
      password: 'test-local-1234',
      email_confirm: true,
    })
    expect(e).toBeNull()
    const c = await clienteComo('sinperfil@pro.agency')
    const { data } = await c.from('concesiones').select('*')
    expect(data).toEqual([])
  })

  it('perfil se vincula al primer login', async () => {
    const a = admin()
    const { error } = await a
      .from('perfiles')
      .insert({ email: 'Nuevo@pro.agency', nombre: 'Nuevo', rol: 'kam' })
    expect(error).toBeNull()
    const { data: u, error: e2 } = await a.auth.admin.createUser({
      email: 'nuevo@pro.agency',
      password: 'test-local-1234',
      email_confirm: true,
    })
    expect(e2).toBeNull()
    const { data: p } = await a.from('perfiles').select('user_id').eq('nombre', 'Nuevo').single()
    expect(p?.user_id).toBe(u.user?.id)
  })

  it('perfil interno exige @pro.agency', async () => {
    const { error } = await admin()
      .from('perfiles')
      .insert({ email: 'x@gmail.com', nombre: 'X', rol: 'kam' })
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
  })
})
