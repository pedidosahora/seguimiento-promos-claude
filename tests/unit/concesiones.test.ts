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
})
