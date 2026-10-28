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

  it('usuario sin confirmar no se vincula', async () => {
    const a = admin()
    await a.from('perfiles').insert({ email: 'pend@pro.agency', nombre: 'Pend', rol: 'kam' })
    const { error } = await a.auth.admin.createUser({
      email: 'pend@pro.agency',
      password: 'test-local-1234',
      email_confirm: false,
    })
    expect(error).toBeNull()
    const { data: p } = await a.from('perfiles').select('user_id').eq('nombre', 'Pend').single()
    expect(p?.user_id).toBeNull()
  })

  it('perfil creado después del login se vincula', async () => {
    const a = admin()
    const { data: u } = await a.auth.admin.createUser({
      email: 'tarde@pro.agency',
      password: 'test-local-1234',
      email_confirm: true,
    })
    const { error } = await a
      .from('perfiles')
      .insert({ email: 'tarde@pro.agency', nombre: 'Tarde', rol: 'kam' })
    expect(error).toBeNull()
    const { data: p } = await a.from('perfiles').select('user_id').eq('nombre', 'Tarde').single()
    expect(p?.user_id).toBe(u.user?.id)
  })

  it('kam no puede cambiar su rol ni su kam asignado', async () => {
    const { perfilId } = await crearUsuario({ email: 'kam@pro.agency', nombre: 'Kam', rol: 'kam' })
    await admin().from('concesiones').insert({ id: 903, razon_social: 'Y S.L.', kam_id: perfilId })
    await admin().from('concesiones').insert({ id: 904, razon_social: 'Z S.L.' })
    const k = await clienteComo('kam@pro.agency')
    await k.from('perfiles').update({ rol: 'admin' }).eq('id', perfilId)
    await k.from('concesiones').update({ kam_id: perfilId }).eq('id', 904)
    await k.from('concesiones').update({ kam_id: null }).eq('id', 903)
    const { data: p } = await admin().from('perfiles').select('rol').eq('id', perfilId).single()
    expect(p?.rol).toBe('kam')
    const { data: c } = await admin().from('concesiones').select('id,kam_id').order('id')
    expect(c).toEqual([
      { id: 903, kam_id: perfilId },
      { id: 904, kam_id: null },
    ])
  })

  it('cambiar el email de un perfil lo revincula con el usuario confirmado', async () => {
    const a = admin()
    const { data: u } = await a.auth.admin.createUser({
      email: 'x@pro.agency',
      password: 'test-local-1234',
      email_confirm: true,
    })
    const { data: creado } = await a
      .from('perfiles')
      .insert({ email: 'xx@pro.agency', nombre: 'Typo', rol: 'kam' })
      .select('id,user_id')
      .single()
    expect(creado?.user_id).toBeNull()
    const { error } = await a.from('perfiles').update({ email: 'X@pro.agency' }).eq('id', creado!.id)
    expect(error).toBeNull()
    const { data: p } = await a.from('perfiles').select('user_id').eq('id', creado!.id).single()
    expect(p?.user_id).toBe(u.user?.id)
  })

  it('cambiar el email a uno sin usuario desvincula el perfil', async () => {
    const { perfilId } = await crearUsuario({ email: 'viejo@pro.agency', nombre: 'Viejo', rol: 'kam' })
    const a = admin()
    const { error } = await a.from('perfiles').update({ email: 'nadie@pro.agency' }).eq('id', perfilId)
    expect(error).toBeNull()
    const { data: p } = await a.from('perfiles').select('user_id').eq('id', perfilId).single()
    expect(p?.user_id).toBeNull()
  })

  it('no se puede dejar el sistema sin administrador activo', async () => {
    const a = admin()
    const { perfilId } = await crearUsuario({ email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' })
    const baja = await a.from('perfiles').update({ activo: false }).eq('id', perfilId)
    expect(baja.error?.message).toMatch(/al menos un administrador activo/)
    const rebaja = await a.from('perfiles').update({ rol: 'kam' }).eq('id', perfilId)
    expect(rebaja.error?.message).toMatch(/al menos un administrador activo/)

    const { perfilId: otro } = await crearUsuario({ email: 'adm2@pro.agency', nombre: 'Adm2', rol: 'admin' })
    expect((await a.from('perfiles').update({ rol: 'kam' }).eq('id', perfilId)).error).toBeNull()
    const ultimo = await a.from('perfiles').update({ activo: false }).eq('id', otro)
    expect(ultimo.error?.message).toMatch(/al menos un administrador activo/)
  })
})
