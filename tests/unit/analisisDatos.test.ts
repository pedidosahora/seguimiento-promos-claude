import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }))
import { cargarFilasAnalisis } from '../../src/app/analisis/datos'

function crudo(i: number, o: Record<string, unknown> = {}) {
  return {
    id: `s${i}`, estado: 'activa', cupos: 5, usos: 2, gsv: '10.5',
    promociones: { id: 'p', tag: 'T', espacio: 'UFS', marca: 'UFS', canal: 'Web', estado: 'publicada', fecha_inicio: '2026-10-01' },
    concesiones: { id: 7, razon_social: 'Razón', nombre_comercial: null, kam_id: 'k', territorios: { nombre: 'Norte' }, kam: { nombre: 'Ana' } },
    ...o,
  }
}

function cliente(paginas: unknown[][]) {
  const rangos: [number, number][] = []
  let n = 0
  const qb: Record<string, unknown> = {}
  qb.select = vi.fn(() => qb)
  qb.neq = vi.fn(() => qb)
  qb.order = vi.fn(() => qb)
  qb.range = vi.fn((a: number, b: number) => {
    rangos.push([a, b])
    return Promise.resolve({ data: paginas[n++] ?? [], error: null })
  })
  return { c: { from: vi.fn(() => qb) } as unknown as SupabaseClient, rangos, qb }
}

describe('cargarFilasAnalisis', () => {
  it('pagina hasta una página vacía y concatena', async () => {
    const p1 = Array.from({ length: 1000 }, (_, i) => crudo(i))
    const p2 = [crudo(1000), crudo(1001)]
    const { c, rangos, qb } = cliente([p1, p2, []])
    const filas = await cargarFilasAnalisis(c)
    expect(qb.order).toHaveBeenCalledWith('id')
    expect(filas).toHaveLength(1002)
    expect(rangos).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })
  it('un max_rows del servidor menor que 1000 no trunca', async () => {
    const corta = (a: number) => Array.from({ length: 100 }, (_, i) => crudo(a + i))
    const { c, rangos } = cliente([corta(0), corta(100), []])
    expect(await cargarFilasAnalisis(c)).toHaveLength(200)
    expect(rangos).toHaveLength(3)
  })
  it('mapea nombre comercial y numéricos', async () => {
    const otra = { id: 8, razon_social: 'R', nombre_comercial: 'Bar', kam_id: null, territorios: null, kam: null }
    const { c, qb } = cliente([[crudo(1), crudo(2, { gsv: null, concesiones: otra })]])
    const [a, b] = await cargarFilasAnalisis(c)
    expect(a.concesion_nombre).toBe('Razón')
    expect(a.gsv).toBe(10.5)
    expect(a.territorio).toBe('Norte')
    expect(a.kam_nombre).toBe('Ana')
    expect(a.tag).toBe('T')
    expect(b.concesion_nombre).toBe('Bar')
    expect(b.gsv).toBeNull()
    expect(b.territorio).toBeNull()
    expect(qb.neq).toHaveBeenCalledWith('promociones.estado', 'borrador')
  })
  it('lanza el error de supabase', async () => {
    const qb: Record<string, unknown> = {}
    qb.select = () => qb
    qb.neq = () => qb
    qb.order = () => qb
    qb.range = () => Promise.resolve({ data: null, error: { message: 'boom' } })
    await expect(cargarFilasAnalisis({ from: () => qb } as unknown as SupabaseClient)).rejects.toThrow('boom')
  })
})
