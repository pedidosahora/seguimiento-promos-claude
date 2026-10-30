import { beforeEach, describe, expect, it } from 'vitest'
import { cargarKams, cargarMisConcesiones, cargarRanking } from '../../src/app/inicio/datos'
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

describe('cargarMisConcesiones', () => {
  let kam: string
  const dia = (desfase: number) =>
    new Date(Date.now() + desfase * 86400000).toISOString().slice(0, 10)

  beforeEach(async () => {
    await resetDatos()
    await crearUsuario({ email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' })
    kam = (await crearUsuario({ email: 'ana@pro.agency', nombre: 'Ana', rol: 'kam' })).perfilId
    const otro = (await crearUsuario({ email: 'bea@pro.agency', nombre: 'Bea', rol: 'kam' })).perfilId
    const { error } = await admin()
      .from('concesiones')
      .insert([
        { id: 9200, razon_social: 'Propia SL', nombre_comercial: 'Propia', kam_id: kam },
        { id: 9201, razon_social: 'Sin Comercial SL', kam_id: kam },
        { id: 9202, razon_social: 'Perm Nulo SL', kam_id: otro },
        { id: 9203, razon_social: 'Perm Ayer SL', kam_id: otro },
        { id: 9204, razon_social: 'Perm Hoy SL', kam_id: otro },
        { id: 9205, razon_social: 'Del Espacio SL', kam_id: otro },
      ])
    if (error) throw error
  })

  it('titular, permisos vigentes y nombre; excluye caducados y permisos por espacio', async () => {
    const { error } = await admin()
      .from('permisos_extra')
      .insert([
        { perfil_id: kam, concesion_id: 9202, caduca: null },
        { perfil_id: kam, concesion_id: 9203, caduca: dia(-1) },
        { perfil_id: kam, concesion_id: 9204, caduca: dia(0) },
        { perfil_id: kam, espacio: 'TMICC' },
      ])
    if (error) throw error
    const ana = await clienteComo('ana@pro.agency')
    const r = await cargarMisConcesiones(kam, ana)
    expect(r.sort((a, b) => a.id - b.id)).toEqual([
      { id: 9200, nombre: 'Propia' },
      { id: 9201, nombre: 'Sin Comercial SL' },
      { id: 9202, nombre: 'Perm Nulo SL' },
      { id: 9204, nombre: 'Perm Hoy SL' },
    ])
  })
})

describe('cargarKams y cargarRanking (admin)', () => {
  beforeEach(async () => {
    await resetDatos()
    await crearUsuario({ email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' })
  })

  it('cargarKams: KAM activos a cero y admin titular, sin duplicados ni inactivos', async () => {
    const ana = (await crearUsuario({ email: 'ana@pro.agency', nombre: 'Ana', rol: 'kam' })).perfilId
    await crearUsuario({ email: 'bea@pro.agency', nombre: 'Bea', rol: 'kam' })
    const baja = (await crearUsuario({ email: 'baja@pro.agency', nombre: 'Baja', rol: 'kam' })).perfilId
    const { error: ep } = await admin().from('perfiles').update({ activo: false }).eq('id', baja)
    if (ep) throw ep
    const { data: adm, error: ea } = await admin()
      .from('perfiles')
      .select('id')
      .eq('email', 'adm@pro.agency')
      .single()
    if (ea) throw ea
    const { error } = await admin()
      .from('concesiones')
      .insert([
        { id: 9300, razon_social: 'A1', kam_id: ana },
        { id: 9301, razon_social: 'A2', kam_id: ana },
        { id: 9302, razon_social: 'Del admin', kam_id: adm.id },
      ])
    if (error) throw error
    const cliente = await clienteComo('adm@pro.agency')
    const r = await cargarKams(cliente)
    expect(r.map((k) => k.nombre).sort()).toEqual(['Adm', 'Ana', 'Bea'])
    expect(new Set(r.map((k) => k.id)).size).toBe(r.length)
  })

  it('cargarRanking: solo publicadas, pct = usos/cupos y null con cupos 0', async () => {
    const pub = await promo('PUB', 'TMICC', 'publicada')
    const cer = await promo('CER', 'UFS', 'cerrada')
    const sin = await promo('SIN', 'UFS', 'publicada')
    const { error: ec } = await admin()
      .from('concesiones')
      .insert([
        { id: 9400, razon_social: 'R1' },
        { id: 9401, razon_social: 'R2' },
      ])
    if (ec) throw ec
    const { error: es } = await admin()
      .from('seguimiento')
      .insert([
        { promocion_id: pub.id, concesion_id: 9400, estado: 'activa', cupos: 10, usos: 5, gsv: 100.5 },
        { promocion_id: pub.id, concesion_id: 9401, estado: 'activa', cupos: 10, usos: 3, gsv: 20 },
        { promocion_id: cer.id, concesion_id: 9400, estado: 'activa', cupos: 10, usos: 10, gsv: 0 },
      ])
    if (es) throw es
    const cliente = await clienteComo('adm@pro.agency')
    const r = await cargarRanking(cliente)
    expect(r.map((f) => f.tag).sort()).toEqual(['PUB', 'SIN'])
    expect(r.find((f) => f.promocion_id === cer.id)).toBeUndefined()
    const p = r.find((f) => f.promocion_id === pub.id)!
    expect(p).toMatchObject({ usos: 8, cupos: 20, activas: 2, gsv: 120.5 })
    expect(p.pct).toBeCloseTo(0.4)
    expect(r.find((f) => f.promocion_id === sin.id)!.pct).toBeNull()
  })
})
