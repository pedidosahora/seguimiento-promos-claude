import { describe, expect, it } from 'vitest'
import { parsearConcesiones } from '../../src/importar/concesiones'

const cab = ['ID', 'CONCESION', 'KAM PRO', 'TERRITORIO']

describe('parsearConcesiones', () => {
  it('lee filas válidas', () => {
    const r = parsearConcesiones([cab, [1, 'A', 'Gisela', 'Norte']])
    expect(r.errores).toEqual([])
    expect(r.filas).toEqual([
      { fila: 2, id: 1, razonSocial: 'A', kam: 'Gisela', territorio: 'Norte' },
    ])
  })
  it('ID vacío y duplicado', () => {
    const r = parsearConcesiones([
      cab,
      [null, 'A', 'G', 'N'],
      [5, 'B', 'G', 'N'],
      [5, 'C', 'G', 'N'],
    ])
    expect(r.errores).toEqual([
      { fila: 2, motivo: 'ID vacío' },
      { fila: 4, motivo: 'ID duplicado' },
    ])
    expect(r.filas).toHaveLength(1)
  })
  it('ID no válido', () => {
    const r = parsearConcesiones([
      cab,
      [0, 'A', 'G', 'N'],
      ['1e3', 'A', 'G', 'N'],
      ['2147483648', 'A', 'G', 'N'],
    ])
    expect(r.filas).toEqual([])
    expect(r.errores.map((e) => e.motivo)).toEqual([
      'ID no válido: 0',
      'ID no válido: 1e3',
      'ID no válido: 2147483648',
    ])
  })
})
