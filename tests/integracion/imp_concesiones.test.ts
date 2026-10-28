import { beforeEach, describe, expect, it } from 'vitest'
import { admin, clienteComo, crearUsuario, resetDatos } from './ayuda'

describe('importar_concesiones', () => {
  beforeEach(async () => {
    await resetDatos()
    await crearUsuario({ email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' })
    await crearUsuario({ email: 'gis@pro.agency', nombre: 'Gisela', rol: 'kam' })
  })
  const filas = [
    { fila: 2, id: 10, razonSocial: 'A', kam: 'Gisela', territorio: 'Norte' },
    { fila: 3, id: 11, razonSocial: 'B', kam: 'Nadie', territorio: 'Sur' },
  ]
  it('simula, aplica y es idempotente', async () => {
    const c = await clienteComo('adm@pro.agency')
    const a = admin()
    const sim = await c.rpc('importar_concesiones', { filas, aplicar: false })
    expect(sim.error).toBeNull()
    expect(sim.data.crear).toBe(1)
    expect(sim.data.errores).toEqual([{ fila: 3, motivo: 'KAM desconocido: Nadie' }])
    expect((await a.from('concesiones').select('id')).data).toEqual([])
    expect((await a.from('territorios').select('id')).data).toEqual([])

    const ap = await c.rpc('importar_concesiones', { filas, aplicar: true })
    expect(ap.data.crear).toBe(1)
    expect((await a.from('concesiones').select('id')).data).toHaveLength(1)

    const otra = await c.rpc('importar_concesiones', { filas, aplicar: true })
    expect(otra.data.sin_cambios).toBe(1)
    expect(otra.data.crear).toBe(0)
  })
  it('rechaza a no admin', async () => {
    const c = await clienteComo('gis@pro.agency')
    const r = await c.rpc('importar_concesiones', { filas, aplicar: false })
    expect(r.error).not.toBeNull()
  })
})
