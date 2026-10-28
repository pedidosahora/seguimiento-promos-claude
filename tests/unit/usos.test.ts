import { describe, expect, it } from 'vitest'
import { parsearUsos } from '../../src/importar/usos'

const cab = ['Id', 'Concesión', 'Tag', 'Usos', 'GSV', 'Fecha actualización']

describe('parsearUsos', () => {
  it('lee filas y marca la que no tiene TAG', () => {
    const r = parsearUsos([
      cab,
      [900, 'Auto A', ' 11bjc426', 12, '1.234,5', '26/10/2026'],
      [901, 'Auto B', '', 1, 2, '26/10/2026'],
      [902, 'Auto C', '11BJC426', 3, 4, 46321],
    ])
    expect(r.errores).toEqual([{ fila: 3, motivo: 'Fila sin TAG' }])
    expect(r.filas).toEqual([
      { fila: 2, id: 900, concesion: 'Auto A', tag: '11BJC426', usos: 12, gsv: 1234.5, fecha: '2026-10-26' },
      { fila: 4, id: 902, concesion: 'Auto C', tag: '11BJC426', usos: 3, gsv: 4, fecha: '2026-10-26' },
    ])
  })
  it('errores de usos, GSV, fecha e ID', () => {
    const r = parsearUsos([
      cab,
      [1, 'A', 'T', 'x', 1, '26/10/2026'],
      [2, 'A', 'T', 1, 'x', '26/10/2026'],
      [3, 'A', 'T', 1, 1, '31/02/2026'],
      [0, 'A', 'T', 1, 1, '26/10/2026'],
      [null, 'A', 'T', 1, 1, '26/10/2026'],
    ])
    expect(r.errores.map((e) => e.motivo)).toEqual([
      'Usos no numérico',
      'GSV no numérico',
      'Fecha no válida',
      'ID no válido: 0',
      'ID vacío',
    ])
  })
  it('faltan columnas', () => {
    const r = parsearUsos([['Id', 'Tag']])
    expect(r.filas).toEqual([])
    expect(r.errores[0].fila).toBe(1)
  })
})
