import { beforeEach, describe, expect, it } from 'vitest'
import { admin, clienteComo, crearUsuario, resetDatos } from './ayuda'

let anaId: string

async function escenario() {
  await resetDatos()
  const a = admin()
  await crearUsuario({ email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' })
  anaId = (
    await crearUsuario({ email: 'ana@pro.agency', nombre: 'Ana', rol: 'kam' })
  ).perfilId
  const beaId = (
    await crearUsuario({ email: 'bea@pro.agency', nombre: 'Bea', rol: 'kam' })
  ).perfilId
  await a.from('concesiones').insert([
    { id: 900, razon_social: 'C900', kam_id: anaId },
    { id: 901, razon_social: 'C901', kam_id: beaId },
  ])
  const { data, error } = await a
    .from('promociones')
    .insert({
      tag: 'T1',
      espacio: 'TMICC',
      marca: 'TMICC',
      mecanica: 'm',
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-02-01',
      estado: 'publicada',
    })
    .select('id')
    .single()
  if (error) throw error
  const { error: e2 } = await a.from('seguimiento').insert([
    { promocion_id: data.id, concesion_id: 900 },
    { promocion_id: data.id, concesion_id: 901 },
  ])
  if (e2) throw e2
  // El montaje del escenario también genera historial: se parte de cero.
  const { error: e3 } = await a.from('historial').delete().gt('id', 0)
  if (e3) throw e3
}

async function entradas() {
  const { data, error } = await admin()
    .from('historial')
    .select('*')
    .eq('tabla', 'seguimiento')
    .eq('accion', 'update')
    .order('id')
  if (error) throw error
  return data
}

describe('historial', () => {
  beforeEach(escenario)

  it('cambio de estado queda registrado', async () => {
    const ana = await clienteComo('ana@pro.agency')
    const { error } = await ana
      .from('seguimiento')
      .update({ estado: 'acepta' })
      .eq('concesion_id', 900)
    expect(error).toBeNull()
    const filas = await entradas()
    expect(filas).toHaveLength(1)
    expect(filas[0].cambios.estado).toEqual({
      antes: 'pendiente',
      despues: 'acepta',
    })
    expect(filas[0].cambios.fecha_aceptacion.antes).toBeNull()
    expect(filas[0].cambios.actualizado_en).toBeUndefined()
    expect(filas[0].autor_id).toBe(anaId)
    expect(filas[0].origen).toBe('manual')
    expect(filas[0].deshecho).toBe(false)
  })

  it('update sin cambios no registra', async () => {
    const ana = await clienteComo('ana@pro.agency')
    const { error } = await ana
      .from('seguimiento')
      .update({ estado: 'pendiente' })
      .eq('concesion_id', 900)
    expect(error).toBeNull()
    expect(await entradas()).toHaveLength(0)
  })

  it('autor deshace su cambio', async () => {
    const ana = await clienteComo('ana@pro.agency')
    await ana.from('seguimiento').update({ estado: 'acepta' }).eq('concesion_id', 900)
    const [primera] = await entradas()
    const { error } = await ana.rpc('deshacer_cambio', { p_id: primera.id })
    expect(error).toBeNull()
    const { data } = await admin()
      .from('seguimiento')
      .select('estado, fecha_aceptacion')
      .eq('concesion_id', 900)
      .single()
    expect(data?.estado).toBe('pendiente')
    expect(data?.fecha_aceptacion).toBeNull()
    const filas = await entradas()
    expect(filas[0].deshecho).toBe(true)
    expect(filas).toHaveLength(2) // el propio deshacer queda registrado
  })

  it('otro kam no puede deshacer cambio ajeno', async () => {
    const ana = await clienteComo('ana@pro.agency')
    await ana.from('seguimiento').update({ estado: 'acepta' }).eq('concesion_id', 900)
    const [primera] = await entradas()
    const bea = await clienteComo('bea@pro.agency')
    const { error } = await bea.rpc('deshacer_cambio', { p_id: primera.id })
    expect(error).not.toBeNull()
    expect((await entradas())[0].deshecho).toBe(false)
  })

  it('no se deshace si hubo cambio posterior', async () => {
    const ana = await clienteComo('ana@pro.agency')
    await ana.from('seguimiento').update({ estado: 'acepta' }).eq('concesion_id', 900)
    await ana.from('seguimiento').update({ estado: 'activa' }).eq('concesion_id', 900)
    const [primera] = await entradas()
    const { error } = await ana.rpc('deshacer_cambio', { p_id: primera.id })
    expect(error?.message).toContain('ha cambiado después')
  })

  it('un cambio no se deshace dos veces', async () => {
    const ana = await clienteComo('ana@pro.agency')
    await ana.from('seguimiento').update({ estado: 'acepta' }).eq('concesion_id', 900)
    const [primera] = await entradas()
    await ana.rpc('deshacer_cambio', { p_id: primera.id })
    const { error } = await ana.rpc('deshacer_cambio', { p_id: primera.id })
    expect(error).not.toBeNull()
  })

  it('registra otras tablas y los internos no escriben el historial', async () => {
    const a = admin()
    await a.from('concesiones').update({ razon_social: 'Nueva' }).eq('id', 900)
    const { data } = await a
      .from('historial')
      .select('tabla, fila_id, cambios')
      .eq('tabla', 'concesiones')
    expect(data?.[0].fila_id).toBe('900')
    expect(data?.[0].cambios.razon_social.despues).toBe('Nueva')
    const ana = await clienteComo('ana@pro.agency')
    const lectura = await ana.from('historial').select('id')
    expect(lectura.error).toBeNull()
    const escritura = await ana
      .from('historial')
      .update({ deshecho: true })
      .gt('id', 0)
      .select('id')
    expect(escritura.data ?? []).toHaveLength(0)
  })
})
