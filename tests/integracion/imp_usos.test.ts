import { beforeEach, describe, expect, it } from 'vitest'
import { admin, clienteComo, crearUsuario, resetDatos } from './ayuda'

let promo: string

const f = (fila: number, id: number, tag: string, usos: number, gsv: number, fecha: string) => ({
  fila,
  id,
  concesion: `Concesión ${id}`,
  tag,
  usos,
  gsv,
  fecha,
})

async function escenario() {
  await resetDatos()
  const a = admin()
  await crearUsuario({ email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' })
  await crearUsuario({ email: 'ana@pro.agency', nombre: 'Ana', rol: 'kam' })
  await a.from('concesiones').insert([
    { id: 900, razon_social: 'C900' },
    { id: 901, razon_social: 'C901' },
    { id: 902, razon_social: 'C902' },
  ])
  const { data, error } = await a
    .from('promociones')
    .insert({
      tag: '11BJC426',
      espacio: 'TMICC',
      marca: 'TMICC',
      mecanica: 'm',
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-12-01',
      estado: 'publicada',
    })
    .select('id')
    .single()
  if (error) throw error
  promo = data.id
  const { error: e2 } = await a.from('seguimiento').insert([
    { promocion_id: promo, concesion_id: 900, estado: 'activa', usos: 10, gsv: 100, fecha_dato: '2026-10-20' },
    { promocion_id: promo, concesion_id: 901, estado: 'no_entra' },
  ])
  if (e2) throw e2
}

const segDe = async (id: number) =>
  (await admin().from('seguimiento').select('usos,gsv,fecha_dato').eq('concesion_id', id).single())
    .data

describe('usos y GSV', () => {
  beforeEach(escenario)

  it('clasifica cada caso', async () => {
    const c = await clienteComo('adm@pro.agency')
    const filas = [
      f(2, 900, 'ZZZ', 1, 1, '2026-10-26'),
      f(3, 999, '11BJC426', 1, 1, '2026-10-26'),
      f(4, 902, '11BJC426', 1, 1, '2026-10-26'),
      f(5, 900, '11BJC426', 1, 1, '2026-10-01'),
      f(7, 901, '11BJC426', 3, 30, '2026-10-26'),
    ]
    const r = await c.rpc('previsualizar_usos', { filas })
    expect(r.error).toBeNull()
    expect(r.data.detalle.map((d: { fila: number; categoria: string }) => [d.fila, d.categoria])).toEqual([
      [2, 'tag_desconocido'],
      [3, 'concesion_desconocida'],
      [4, 'no_convocada'],
      [5, 'dato_antiguo'],
      [7, 'aviso_no_entra'],
    ])
    expect(r.data.conteos).toEqual({
      tag_desconocido: 1,
      concesion_desconocida: 1,
      no_convocada: 1,
      dato_antiguo: 1,
      aviso_no_entra: 1,
    })
    // la 900 con fecha 2026-10-26 (en un lote aparte, para no duplicar TAG+ID)
    const act = await c.rpc('previsualizar_usos', {
      filas: [f(2, 900, '11BJC426', 12, 120, '2026-10-26')],
    })
    expect(act.data.conteos).toEqual({ actualiza: 1 })
    // la vista previa no escribe
    expect((await segDe(900))?.usos).toBe(10)
  })

  it('aplicar sustituye, no suma', async () => {
    const c = await clienteComo('adm@pro.agency')
    const r = await c.rpc('aplicar_usos', {
      filas: [f(2, 900, ' 11bjc426 ', 12, 120.5, '2026-10-26')],
      incluir_antiguos: false,
    })
    expect(r.error).toBeNull()
    expect(r.data.aplicadas).toBe(1)
    expect(await segDe(900)).toEqual({ usos: 12, gsv: 120.5, fecha_dato: '2026-10-26' })
    const nc = await admin().from('concesiones').select('nombre_comercial').eq('id', 900).single()
    expect(nc.data?.nombre_comercial).toBe('Concesión 900')
  })

  it('reimportar no duplica', async () => {
    const c = await clienteComo('adm@pro.agency')
    const filas = [f(2, 900, '11BJC426', 12, 120, '2026-10-26'), f(3, 901, '11BJC426', 3, 30, '2026-10-26')]
    const primera = await c.rpc('aplicar_usos', { filas, incluir_antiguos: false })
    expect(primera.data.aplicadas).toBe(2)
    const antes = (await admin().from('historial').select('id')).data?.length
    const otra = await c.rpc('aplicar_usos', { filas, incluir_antiguos: false })
    expect(otra.error).toBeNull()
    expect(otra.data.aplicadas).toBe(0)
    expect(otra.data.conteos).toEqual({ sin_cambios: 2 })
    expect((await admin().from('historial').select('id')).data?.length).toBe(antes)
  })

  it('antiguo solo con permiso explícito', async () => {
    const c = await clienteComo('adm@pro.agency')
    const filas = [f(2, 900, '11BJC426', 5, 50, '2026-10-01')]
    const sin = await c.rpc('aplicar_usos', { filas, incluir_antiguos: false })
    expect(sin.data.aplicadas).toBe(0)
    expect((await segDe(900))?.usos).toBe(10)
    const con = await c.rpc('aplicar_usos', { filas, incluir_antiguos: true })
    expect(con.data.aplicadas).toBe(1)
    expect(await segDe(900)).toEqual({ usos: 5, gsv: 50, fecha_dato: '2026-10-01' })
  })

  it('historial marca origen', async () => {
    const c = await clienteComo('adm@pro.agency')
    await admin().from('historial').delete().not('id', 'is', null)
    await c.rpc('aplicar_usos', {
      filas: [f(2, 900, '11BJC426', 12, 120, '2026-10-26')],
      incluir_antiguos: false,
    })
    const h = await admin().from('historial').select('tabla,origen')
    expect(h.data?.length).toBeGreaterThan(0)
    expect(h.data?.every((x) => x.origen === 'importacion_usos')).toBe(true)
  })

  it('kam no puede importar', async () => {
    const c = await clienteComo('ana@pro.agency')
    const filas = [f(2, 900, '11BJC426', 12, 120, '2026-10-26')]
    expect((await c.rpc('previsualizar_usos', { filas })).error).not.toBeNull()
    expect((await c.rpc('aplicar_usos', { filas, incluir_antiguos: false })).error).not.toBeNull()
    expect((await c.rpc('clasificar_usos', { filas })).error).not.toBeNull()
    expect((await segDe(900))?.usos).toBe(10)
  })

  it('duplicadas: no se aplican y es estable', async () => {
    const c = await clienteComo('adm@pro.agency')
    const filas = [f(2, 900, '11BJC426', 50, 500, '2026-10-26'), f(3, 900, ' 11bjc426', 60, 600, '2026-10-26')]
    for (let i = 0; i < 2; i++) {
      const r = await c.rpc('aplicar_usos', { filas, incluir_antiguos: true })
      expect(r.error).toBeNull()
      expect(r.data).toEqual({ aplicadas: 0, conteos: { duplicada: 2 } })
    }
    const p = await c.rpc('previsualizar_usos', { filas })
    expect(p.data.conteos).toEqual({ duplicada: 2 })
    expect(p.data.detalle.map((d: { categoria: string }) => d.categoria)).toEqual(['duplicada', 'duplicada'])
    expect(await segDe(900)).toEqual({ usos: 10, gsv: 100, fecha_dato: '2026-10-20' })
  })

  it('nombre_comercial solo desde filas aplicadas', async () => {
    const c = await clienteComo('adm@pro.agency')
    await c.rpc('aplicar_usos', {
      filas: [f(2, 902, 'ZZZ', 1, 1, '2026-10-26'), f(3, 900, '11BJC426', 12, 120, '2026-10-26')],
      incluir_antiguos: false,
    })
    const n = await admin().from('concesiones').select('id,nombre_comercial').in('id', [900, 902]).order('id')
    expect(n.data).toEqual([
      { id: 900, nombre_comercial: 'Concesión 900' },
      { id: 902, nombre_comercial: null },
    ])
  })

  it('rendimiento: 7.000 filas', async () => {
    const a = admin()
    const ids = Array.from({ length: 7000 }, (_, i) => 10000 + i)
    for (let i = 0; i < ids.length; i += 1000) {
      const lote = ids.slice(i, i + 1000)
      const { error } = await a
        .from('concesiones')
        .insert(lote.map((id) => ({ id, razon_social: `R${id}` })))
      if (error) throw error
      const { error: e } = await a
        .from('seguimiento')
        .insert(lote.map((id) => ({ promocion_id: promo, concesion_id: id, estado: 'activa' })))
      if (e) throw e
    }
    const c = await clienteComo('adm@pro.agency')
    const filas = ids.map((id, i) => f(i + 2, id, '11BJC426', 5, 50, '2026-10-26'))
    const t0 = Date.now()
    const r = await c.rpc('aplicar_usos', { filas, incluir_antiguos: false })
    const ms = Date.now() - t0
    console.log(`aplicar_usos 7000 filas: ${ms} ms`)
    expect(r.error).toBeNull()
    expect(r.data.aplicadas).toBe(7000)
    expect(ms).toBeLessThan(10000)
  }, 60000)
})
