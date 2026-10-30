import { beforeEach, describe, expect, it } from 'vitest'
import { admin, clienteComo, crearUsuario, resetDatos } from './ayuda'

async function promo(tag: string, espacio: string, estado: string) {
  const { data, error } = await admin()
    .from('promociones')
    .insert({
      tag,
      espacio,
      marca: espacio,
      mecanica: 'm',
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-02-01',
      estado,
    })
    .select('id, publicada_en')
    .single()
  if (error) throw error
  return data
}

describe('inicio: campos, triggers y vista', () => {
  let anaPerfil: string

  beforeEach(async () => {
    await resetDatos()
    await crearUsuario({ email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' })
    anaPerfil = (
      await crearUsuario({ email: 'ana@pro.agency', nombre: 'Ana', rol: 'kam' })
    ).perfilId
    const bea = await crearUsuario({ email: 'bea@pro.agency', nombre: 'Bea', rol: 'kam' })
    const { error } = await admin()
      .from('concesiones')
      .insert([
        { id: 9100, razon_social: 'Uno SL', nombre_comercial: 'Uno', kam_id: anaPerfil },
        { id: 9101, razon_social: 'Dos SL', kam_id: bea.perfilId },
      ])
    if (error) throw error
  })

  it('cupos_revisado_en se pone al cambiar cupos', async () => {
    const inicio = Date.now()
    const p = await promo('P1', 'TMICC', 'publicada')
    const { data: s, error } = await admin()
      .from('seguimiento')
      .insert({
        promocion_id: p.id,
        concesion_id: 9100,
        cupos: 10,
        cupos_revisado_en: '2026-01-01T00:00:00Z',
      })
      .select('id')
      .single()
    if (error) throw error

    // service_role no pasa es_admin() (auth.uid() nulo): se actualiza como admin real.
    const a = await clienteComo('adm@pro.agency')
    const { data: a1, error: e1 } = await a
      .from('seguimiento')
      .update({ cupos: 20 })
      .eq('id', s.id)
      .select('cupos_revisado_en')
      .single()
    if (e1) throw e1
    expect(new Date(a1.cupos_revisado_en).getTime()).toBeGreaterThan(inicio - 1000)

    const antes = a1.cupos_revisado_en
    const { data: a2, error: e2 } = await a
      .from('seguimiento')
      .update({ estado: 'activa' })
      .eq('id', s.id)
      .select('cupos_revisado_en')
      .single()
    if (e2) throw e2
    expect(a2.cupos_revisado_en).toBe(antes)
  })

  it('cupos_revisado_en explícito se respeta', async () => {
    const p = await promo('P1', 'TMICC', 'publicada')
    const { data: s, error } = await admin()
      .from('seguimiento')
      .insert({ promocion_id: p.id, concesion_id: 9100 })
      .select('id')
      .single()
    if (error) throw error

    const ahora = new Date().toISOString()
    const ana = await clienteComo('ana@pro.agency')
    const { error: eu } = await ana
      .from('seguimiento')
      .update({ cupos_revisado_en: ahora })
      .eq('id', s.id)
    expect(eu).toBeNull()

    const { data: h, error: eh } = await admin()
      .from('historial')
      .select('cambios')
      .eq('tabla', 'seguimiento')
      .eq('fila_id', s.id)
      .eq('accion', 'update')
    if (eh) throw eh
    expect(h.some((r) => 'cupos_revisado_en' in r.cambios)).toBe(true)
  })

  it('fila nueva nace revisada', async () => {
    const p = await promo('P1', 'TMICC', 'publicada')
    const { data, error } = await admin()
      .from('seguimiento')
      .insert({ promocion_id: p.id, concesion_id: 9100 })
      .select('cupos_revisado_en')
      .single()
    if (error) throw error
    expect(data.cupos_revisado_en).not.toBeNull()
  })

  it('publicada_en al publicar', async () => {
    const b = await promo('B1', 'TMICC', 'borrador')
    expect(b.publicada_en).toBeNull()
    const { data, error } = await admin()
      .from('promociones')
      .update({ estado: 'publicada' })
      .eq('id', b.id)
      .select('publicada_en')
      .single()
    if (error) throw error
    expect(data.publicada_en).not.toBeNull()

    const d = await promo('D1', 'UFS', 'publicada')
    expect(d.publicada_en).not.toBeNull()
  })

  it('v_inicio_filas solo publicadas y editable por usuario', async () => {
    const pub = await promo('PUB', 'TMICC', 'publicada')
    const cer = await promo('CER', 'TMICC', 'cerrada')
    const { error } = await admin()
      .from('seguimiento')
      .insert(
        [pub.id, cer.id].flatMap((id) => [
          { promocion_id: id, concesion_id: 9100 },
          { promocion_id: id, concesion_id: 9101 },
        ]),
      )
    if (error) throw error

    const ana = await clienteComo('ana@pro.agency')
    const { data, error: ev } = await ana.from('v_inicio_filas').select('*')
    if (ev) throw ev
    expect(data).toHaveLength(2)
    expect(data.every((f) => f.promocion_id === pub.id)).toBe(true)
    const f0 = data.find((f) => f.concesion_id === 9100)
    const f1 = data.find((f) => f.concesion_id === 9101)
    expect(f0.editable).toBe(true)
    expect(f1.editable).toBe(false)
    expect(f0.kam_nombre).toBe('Ana')
    expect(f0.concesion_nombre).toBe('Uno')
    expect(f1.concesion_nombre).toBe('Dos SL')
  })

  it('permiso extra por espacio hace editable', async () => {
    const pub = await promo('PUB', 'TMICC', 'publicada')
    const { error } = await admin()
      .from('seguimiento')
      .insert({ promocion_id: pub.id, concesion_id: 9101 })
    if (error) throw error
    const { error: ep } = await admin()
      .from('permisos_extra')
      .insert({ perfil_id: anaPerfil, espacio: 'TMICC' })
    if (ep) throw ep

    const ana = await clienteComo('ana@pro.agency')
    const { data, error: ev } = await ana
      .from('v_inicio_filas')
      .select('editable')
      .eq('concesion_id', 9101)
      .single()
    if (ev) throw ev
    expect(data.editable).toBe(true)
  })
})
