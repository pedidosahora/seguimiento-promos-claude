import { beforeEach, describe, expect, it } from 'vitest'
import { admin, clienteComo, crearUsuario, resetDatos } from './ayuda'

describe('v_resumen_promocion', () => {
  beforeEach(async () => {
    await resetDatos()
    await crearUsuario({ email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' })
  })

  it('resumen como en la hoja', async () => {
    const a = admin()
    const ids = Array.from({ length: 36 }, (_, i) => 1000 + i)
    const { error: ec } = await a
      .from('concesiones')
      .insert(ids.map((id) => ({ id, razon_social: `C${id}` })))
    if (ec) throw ec
    const { data: p, error: ep } = await a
      .from('promociones')
      .insert({
        tag: '3EXPERIENCIAC326',
        espacio: 'TMICC',
        marca: 'TMICC',
        mecanica: 'm',
        fecha_inicio: '2026-01-01',
        fecha_fin: '2026-02-01',
        estado: 'publicada',
      })
      .select('id')
      .single()
    if (ep) throw ep
    const estados = [
      ...Array(2).fill('pendiente'),
      ...Array(2).fill('rechaza'),
      ...Array(31).fill('activa'),
      'no_entra',
    ]
    const { error: es } = await a.from('seguimiento').insert(
      ids.map((id, i) => ({
        promocion_id: p.id,
        concesion_id: id,
        estado: estados[i],
      })),
    )
    if (es) throw es

    const cliente = await clienteComo('adm@pro.agency')
    const { data, error } = await cliente
      .from('v_resumen_promocion')
      .select('*')
      .eq('promocion_id', p.id)
      .single()
    if (error) throw error
    expect(data.convocadas).toBe(36)
    expect(data.presentadas).toBe(35)
    expect(data.aceptadas).toBe(31)
    expect(data.activas).toBe(31)
    expect(data.pendientes).toBe(2)
    expect(data.rechazadas).toBe(2)
    expect(Number(data.pct_aceptacion)).toBeCloseTo(0.8857, 4)
    expect(data.cupos).toBe(0)
  })

  it('promoción sin filas: ceros y porcentajes null', async () => {
    const a = admin()
    const { data: p, error: ep } = await a
      .from('promociones')
      .insert({ tag: 'VACIA', espacio: 'UFS', marca: 'UFS' })
      .select('id')
      .single()
    if (ep) throw ep
    const cliente = await clienteComo('adm@pro.agency')
    const { data, error } = await cliente
      .from('v_resumen_promocion')
      .select('*')
      .eq('promocion_id', p.id)
      .single()
    if (error) throw error
    expect(data.convocadas).toBe(0)
    expect(data.presentadas).toBe(0)
    expect(data.pct_aceptacion).toBeNull()
    expect(Number(data.gsv)).toBe(0)
  })
})
