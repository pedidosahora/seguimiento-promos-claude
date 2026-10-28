import { beforeEach, describe, expect, it } from 'vitest'
import { admin, clienteComo, crearUsuario, resetDatos } from './ayuda'

type Fila = Record<string, unknown>

const fila = (id: number, extra: Fila = {}): Fila => ({
  fila: 12,
  id,
  concesion: `Auto ${id}`,
  kam: '',
  territorio: '',
  estado: 'activa',
  fechaAceptacion: null,
  fechaActivacion: null,
  cupos: null,
  usos: null,
  gsv: null,
  sms: null,
  email: null,
  ...extra,
})

const promo = (tag: string, filas: Fila[], extra: Fila = {}) => ({
  tag,
  mecanica: '2x1',
  objetivo: 'Rotación',
  canal: 'WhatsApp',
  fechaInicio: '2026-09-01',
  fechaFin: '2026-09-30',
  filas,
  ...extra,
})

const datos = (promociones: unknown[], marca?: string) => ({ marca: marca ?? null, promociones })

async function escenario() {
  await resetDatos()
  await crearUsuario({ email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' })
  await crearUsuario({ email: 'ana@pro.agency', nombre: 'Ana', rol: 'kam' })
  await admin().from('concesiones').insert({ id: 900, razon_social: 'Existente 900' })
}

const segs = async (tag: string) => {
  const { data } = await admin()
    .from('seguimiento')
    .select('concesion_id,estado,cupos,usos,gsv,fecha_dato,sms,email,promociones!inner(tag)')
    .eq('promociones.tag', tag)
    .order('concesion_id')
  return data ?? []
}

describe('importación del histórico', () => {
  beforeEach(escenario)

  it('crea promociones cerradas', async () => {
    const c = await clienteComo('adm@pro.agency')
    const r = await c.rpc('aplicar_historico', {
      datos: datos([promo(' sept1', [fila(900, { usos: 18, gsv: 250.5, sms: 'enviado', email: 'enviado' })])]),
      p_espacio: 'TMICC',
      tags_actualizar: [],
    })
    expect(r.error).toBeNull()
    expect(r.data).toEqual({ creadas: 1, actualizadas: 0, omitidas: 0, concesiones_creadas: 0 })
    const { data: p } = await admin().from('promociones').select('*').eq('tag', 'SEPT1').single()
    expect(p).toMatchObject({ espacio: 'TMICC', marca: 'TMICC', estado: 'cerrada', mecanica: '2x1' })
    const s = await segs('SEPT1')
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({
      concesion_id: 900, estado: 'activa', usos: 18, gsv: 250.5, fecha_dato: null,
      sms: 'enviado', email: 'enviado',
    })
  })

  it('concesión desconocida se crea inactiva, con territorio y KAM', async () => {
    const c = await clienteComo('adm@pro.agency')
    const d = datos([
      promo('SEPT1', [
        fila(901, { concesion: 'Nueva SL', kam: 'ana', territorio: 'Levante' }),
        fila(902, { concesion: 'Otra SL', kam: 'Nadie', territorio: 'Levante' }),
        fila(900, { concesion: 'Cambiada', territorio: 'Norte' }),
      ]),
    ])
    const prev = await c.rpc('previsualizar_historico', { datos: d, p_espacio: 'UFS' })
    expect(prev.error).toBeNull()
    expect(prev.data.promociones).toEqual([
      { tag: 'SEPT1', accion: 'crear', filas: 3, concesiones_nuevas: [901, 902], aviso: null },
    ])
    expect(prev.data.totales).toMatchObject({ promociones: 1, crear: 1, filas: 3, concesiones_nuevas: 2 })
    const r = await c.rpc('aplicar_historico', { datos: d, p_espacio: 'UFS', tags_actualizar: [] })
    expect(r.error).toBeNull()
    expect(r.data.concesiones_creadas).toBe(2)
    const { data: cs } = await admin()
      .from('concesiones')
      .select('id,razon_social,activa,kam_id,territorios(nombre)')
      .in('id', [900, 901, 902])
      .order('id')
    expect(cs![0]).toMatchObject({ razon_social: 'Existente 900', activa: true, territorios: null })
    expect(cs![1]).toMatchObject({ razon_social: 'Nueva SL', activa: false, territorios: { nombre: 'Levante' } })
    expect(cs![1].kam_id).not.toBeNull()
    expect(cs![2]).toMatchObject({ activa: false, kam_id: null })
    const { data: p } = await admin().from('promociones').select('marca,espacio').eq('tag', 'SEPT1').single()
    expect(p).toMatchObject({ espacio: 'UFS', marca: 'UFS' })
  })

  it('bloque incompleto se importa como borrador con aviso', async () => {
    const c = await clienteComo('adm@pro.agency')
    const d = datos([
      promo('SIN-MEC', [fila(900)], { mecanica: null }),
      promo('FIN-ANTES', [fila(900)], { fechaInicio: '2026-10-01', fechaFin: '2026-09-01' }),
      promo('SIN-FECHA', [fila(900)], { fechaInicio: null }),
    ])
    const prev = await c.rpc('previsualizar_historico', { datos: d, p_espacio: 'TMICC' })
    expect(prev.data.totales.avisos).toBe(3)
    expect(prev.data.promociones.every((p: { aviso: string }) => /borrador/.test(p.aviso))).toBe(true)
    const r = await c.rpc('aplicar_historico', { datos: d, p_espacio: 'TMICC', tags_actualizar: [] })
    expect(r.error).toBeNull()
    expect(r.data.creadas).toBe(3)
    const { data } = await admin().from('promociones').select('tag,estado').order('tag')
    expect(data!.map((p) => p.estado)).toEqual(['borrador', 'borrador', 'borrador'])
  })

  it('CAMPANAS exige la marca y la usa', async () => {
    const c = await clienteComo('adm@pro.agency')
    const sin = await c.rpc('aplicar_historico', {
      datos: datos([promo('CAMP1', [fila(900)])]),
      p_espacio: 'CAMPANAS',
      tags_actualizar: [],
    })
    expect(sin.error).not.toBeNull()
    const con = await c.rpc('aplicar_historico', {
      datos: datos([promo('CAMP1', [fila(900)])], 'UFS'),
      p_espacio: 'CAMPANAS',
      tags_actualizar: [],
    })
    expect(con.error).toBeNull()
    const { data } = await admin().from('promociones').select('espacio,marca').eq('tag', 'CAMP1').single()
    expect(data).toEqual({ espacio: 'CAMPANAS', marca: 'UFS' })
  })

  it('reimportar omite por defecto', async () => {
    const c = await clienteComo('adm@pro.agency')
    const d = datos([promo('SEPT1', [fila(900, { usos: 5 })])])
    await c.rpc('aplicar_historico', { datos: d, p_espacio: 'TMICC', tags_actualizar: [] })
    const antes = await segs('SEPT1')
    const d2 = datos([promo('SEPT1', [fila(900, { usos: 99 }), fila(901)])])
    const prev = await c.rpc('previsualizar_historico', { datos: d2, p_espacio: 'TMICC' })
    expect(prev.data.promociones[0]).toMatchObject({ tag: 'SEPT1', accion: 'ya_existe' })
    const r = await c.rpc('aplicar_historico', { datos: d2, p_espacio: 'TMICC', tags_actualizar: [] })
    expect(r.error).toBeNull()
    expect(r.data).toEqual({ creadas: 0, actualizadas: 0, omitidas: 1, concesiones_creadas: 0 })
    expect(await segs('SEPT1')).toEqual(antes)
  })

  it('actualizar solo rellena vacíos', async () => {
    const c = await clienteComo('adm@pro.agency')
    await c.rpc('aplicar_historico', {
      datos: datos([
        promo('SEPT1', [fila(900, { cupos: 20 }), fila(901, { cupos: null, usos: 7 })], {
          objetivo: null,
        }),
      ]),
      p_espacio: 'TMICC',
      tags_actualizar: [],
    })
    const d2 = datos([
      promo('SEPT1', [
        fila(900, { cupos: 30, usos: 40 }),
        fila(901, { cupos: 30, usos: 99 }),
        fila(902, { cupos: 5 }),
      ], { mecanica: 'OTRA', objetivo: 'Nuevo objetivo' }),
    ])
    const r = await c.rpc('aplicar_historico', {
      datos: d2,
      p_espacio: 'TMICC',
      tags_actualizar: ['sept1'],
    })
    expect(r.error).toBeNull()
    expect(r.data).toMatchObject({ creadas: 0, actualizadas: 1, omitidas: 0, concesiones_creadas: 1 })
    const s = await segs('SEPT1')
    expect(s.map((x) => [x.concesion_id, x.cupos, x.usos])).toEqual([
      [900, 20, 40], // cupos ya tenía valor; usos estaba vacío
      [901, 30, 7], // cupos vacío → 30; usos ya tenía valor
      [902, 5, null], // fila nueva
    ])
    const { data: p } = await admin().from('promociones').select('mecanica,objetivo').eq('tag', 'SEPT1').single()
    expect(p).toEqual({ mecanica: '2x1', objetivo: 'Nuevo objetivo' })
  })

  it('usos posteriores prevalecen', async () => {
    const c = await clienteComo('adm@pro.agency')
    await c.rpc('aplicar_historico', {
      datos: datos([promo('SEPT1', [fila(900, { usos: 5, gsv: 50 })])]),
      p_espacio: 'TMICC',
      tags_actualizar: [],
    })
    const f = (fecha: string, usos: number) => ({
      fila: 2, id: 900, concesion: 'Auto 900', tag: 'SEPT1', usos, gsv: 99, fecha,
    })
    // Tras el histórico (fecha_dato vacía) cualquier carga prevalece, también una de fecha anterior al fin
    const previa = await c.rpc('previsualizar_usos', { filas: [f('2026-09-01', 1)] })
    expect(previa.data.detalle).toEqual([])
    expect(previa.data.conteos).toEqual({ actualiza: 1 })
    const nuevo = await c.rpc('aplicar_usos', { filas: [f('2026-10-26', 30)] })
    expect(nuevo.error).toBeNull()
    expect(nuevo.data.aplicadas).toBe(1)
    expect((await segs('SEPT1'))[0]).toMatchObject({ usos: 30, fecha_dato: '2026-10-26' })

    // Ahora sí hay fecha guardada: un dato anterior es antiguo
    const prev = await c.rpc('previsualizar_usos', { filas: [f('2026-09-01', 1)] })
    expect(prev.data.detalle[0].categoria).toBe('dato_antiguo')
  })

  it('solo administradores', async () => {
    const c = await clienteComo('ana@pro.agency')
    const d = datos([promo('SEPT1', [fila(900)])])
    expect((await c.rpc('previsualizar_historico', { datos: d, p_espacio: 'TMICC' })).error).not.toBeNull()
    expect(
      (await c.rpc('aplicar_historico', { datos: d, p_espacio: 'TMICC', tags_actualizar: [] })).error,
    ).not.toBeNull()
  })

  it('la importación queda en el historial con su origen', async () => {
    const c = await clienteComo('adm@pro.agency')
    await c.rpc('aplicar_historico', {
      datos: datos([promo('SEPT1', [fila(900)])]),
      p_espacio: 'TMICC',
      tags_actualizar: [],
    })
    const { data } = await admin().from('historial').select('origen').eq('tabla', 'seguimiento')
    expect(data!.length).toBeGreaterThan(0)
    expect(data!.every((h) => h.origen === 'importacion_historico')).toBe(true)
  })

  it('una promoción existente de otro espacio se muestra y no se actualiza', async () => {
    const c = await clienteComo('adm@pro.agency')
    await c.rpc('aplicar_historico', {
      datos: datos([promo('SEPT1', [fila(900, { usos: 5 })])]),
      p_espacio: 'TMICC',
      tags_actualizar: [],
    })
    const antes = await segs('SEPT1')
    const d2 = datos([promo('SEPT1', [fila(900, { usos: 99, cupos: 50 }), fila(901)])], 'UFS')
    const prev = await c.rpc('previsualizar_historico', { datos: d2, p_espacio: 'UFS' })
    expect(prev.error).toBeNull()
    expect(prev.data.promociones[0]).toMatchObject({ tag: 'SEPT1', accion: 'ya_existe', espacio: 'TMICC' })
    const r = await c.rpc('aplicar_historico', { datos: d2, p_espacio: 'UFS', tags_actualizar: ['SEPT1'] })
    expect(r.error).toBeNull()
    expect(r.data).toMatchObject({ actualizadas: 0, omitidas: 1, concesiones_creadas: 0 })
    expect(r.data.omitidas_otro_espacio).toEqual([
      { tag: 'SEPT1', motivo: expect.stringContaining('TMICC') },
    ])
    expect(await segs('SEPT1')).toEqual(antes)
  })
})
