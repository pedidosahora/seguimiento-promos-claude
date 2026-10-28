import { beforeEach, describe, expect, it, vi } from 'vitest'
import { admin, clienteComo, crearUsuario, resetDatos } from './ayuda'

// El servicio importa el cliente de la app (sin entorno Vite aquí); cada prueba pasa el suyo.
vi.mock('../../src/lib/supabase', () => ({ supabase: null }))

import { ConflictoError, guardarEnBloque, guardarFila } from '../../src/app/promocion/servicio'

let anaId: string
let promo: string
let fila900: string
let fila901: string

async function escenario() {
  await resetDatos()
  const a = admin()
  await crearUsuario({ email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' })
  anaId = (await crearUsuario({ email: 'ana@pro.agency', nombre: 'Ana', rol: 'kam' })).perfilId
  const beaId = (await crearUsuario({ email: 'bea@pro.agency', nombre: 'Bea', rol: 'kam' })).perfilId
  await a.from('concesiones').insert([
    { id: 900, razon_social: 'C900', kam_id: anaId },
    { id: 901, razon_social: 'C901', kam_id: beaId },
  ])
  const { data, error } = await a
    .from('promociones')
    .insert({
      tag: 'T1', espacio: 'TMICC', marca: 'TMICC', mecanica: 'm',
      fecha_inicio: '2026-01-01', fecha_fin: '2026-02-01', estado: 'publicada',
    })
    .select('id')
    .single()
  if (error) throw error
  promo = data.id
  const { data: filas, error: e2 } = await a
    .from('seguimiento')
    .insert([
      { promocion_id: promo, concesion_id: 900 },
      { promocion_id: promo, concesion_id: 901 },
    ])
    .select('id, concesion_id')
  if (e2) throw e2
  fila900 = filas!.find((f) => f.concesion_id === 900)!.id
  fila901 = filas!.find((f) => f.concesion_id === 901)!.id
  // Bea tiene permiso extra sobre la concesión de Ana
  await a.from('permisos_extra').insert({ perfil_id: beaId, concesion_id: 900 })
}

describe('servicio de seguimiento', () => {
  beforeEach(escenario)

  it('conflicto de concurrencia: gana el primero y el segundo recibe ConflictoError', async () => {
    const ana = await clienteComo('ana@pro.agency')
    const bea = await clienteComo('bea@pro.agency')
    const { data: leidaAna } = await ana.from('seguimiento').select('*').eq('id', fila900).single()
    const { data: leidaBea } = await bea.from('seguimiento').select('*').eq('id', fila900).single()
    expect(leidaBea!.actualizado_en).toBe(leidaAna!.actualizado_en)

    const guardada = await guardarFila(fila900, { estado: 'acepta' }, leidaAna!.actualizado_en, ana)
    expect(guardada.estado).toBe('acepta')
    expect(guardada.actualizado_en).not.toBe(leidaAna!.actualizado_en)

    const intento = guardarFila(fila900, { estado: 'rechaza' }, leidaBea!.actualizado_en, bea)
    await expect(intento).rejects.toBeInstanceOf(ConflictoError)
    await expect(intento).rejects.toThrow('Esta fila ha cambiado; recarga')

    const { data } = await admin().from('seguimiento').select('estado').eq('id', fila900).single()
    expect(data?.estado).toBe('acepta')
  })

  it('con la versión nueva sí guarda', async () => {
    const ana = await clienteComo('ana@pro.agency')
    const { data } = await ana.from('seguimiento').select('actualizado_en').eq('id', fila900).single()
    const r1 = await guardarFila(fila900, { cupos: 10 }, data!.actualizado_en, ana)
    const r2 = await guardarFila(fila900, { cupos: 20 }, r1.actualizado_en, ana)
    expect(r2.cupos).toBe(20)
  })

  it('propaga el error del servidor tal cual', async () => {
    const ana = await clienteComo('ana@pro.agency')
    const { data } = await admin().from('seguimiento').select('actualizado_en').eq('id', fila901).single()
    await expect(guardarFila(fila901, { estado: 'acepta' }, data!.actualizado_en, ana)).rejects.toThrow(
      'Sin permiso para editar esta fila',
    )
  })

  it('guardarEnBloque informa ok y fallidas', async () => {
    const ana = await clienteComo('ana@pro.agency')
    const r = await guardarEnBloque([fila900, fila901], { estado: 'acepta', sms: 'enviado' }, undefined, ana)
    expect(r.ok).toBe(1)
    expect(r.fallidas).toEqual([{ id: fila901, motivo: 'Sin permiso para editar esta fila' }])
    const { data } = await admin().from('seguimiento').select('estado, sms').eq('id', fila900).single()
    expect(data).toEqual({ estado: 'acepta', sms: 'enviado' })
  })

  it('guardarEnBloque con versión obsoleta: esa fila va a fallidas y se conserva el valor ajeno', async () => {
    const bea = await clienteComo('bea@pro.agency')
    const ana = await clienteComo('ana@pro.agency')
    const { data: a } = await bea.from('seguimiento').select('actualizado_en').eq('id', fila900).single()
    const { data: b } = await bea.from('seguimiento').select('actualizado_en').eq('id', fila901).single()
    // Ana cambia su fila después de que Bea la leyera
    await guardarFila(fila900, { estado: 'rechaza' }, a!.actualizado_en, ana)
    const r = await guardarEnBloque(
      [fila900, fila901],
      { estado: 'acepta' },
      { [fila900]: a!.actualizado_en, [fila901]: b!.actualizado_en },
      bea,
    )
    expect(r.ok).toBe(1)
    expect(r.fallidas).toEqual([{ id: fila900, motivo: 'Esta fila ha cambiado; recarga' }])
    const { data } = await admin().from('seguimiento').select('id, estado').in('id', [fila900, fila901])
    expect(Object.fromEntries(data!.map((x) => [x.id, x.estado]))).toEqual({
      [fila900]: 'rechaza',
      [fila901]: 'acepta',
    })
  })

  it('concesiones_editables devuelve solo las que puede editar quien llama', async () => {
    const ana = await clienteComo('ana@pro.agency')
    const bea = await clienteComo('bea@pro.agency')
    const adm = await clienteComo('adm@pro.agency')
    const ordenar = (v: number[]) => [...v].sort()
    expect(ordenar((await ana.rpc('concesiones_editables', { p_promocion: promo })).data)).toEqual([900])
    expect(ordenar((await bea.rpc('concesiones_editables', { p_promocion: promo })).data)).toEqual([900, 901])
    expect(ordenar((await adm.rpc('concesiones_editables', { p_promocion: promo })).data)).toEqual([900, 901])
    // promoción cerrada: el kam no edita nada; admin sí
    await admin().from('promociones').update({ estado: 'cerrada' }).eq('id', promo)
    expect((await ana.rpc('concesiones_editables', { p_promocion: promo })).data).toEqual([])
    expect(ordenar((await adm.rpc('concesiones_editables', { p_promocion: promo })).data)).toEqual([900, 901])
  })

  it('anon no puede llamar a concesiones_editables', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const anon = createClient(process.env.API_URL ?? 'http://127.0.0.1:54421', process.env.ANON_KEY ?? '')
    const { error } = await anon.rpc('concesiones_editables', { p_promocion: promo })
    expect(error).not.toBeNull()
  })
})
