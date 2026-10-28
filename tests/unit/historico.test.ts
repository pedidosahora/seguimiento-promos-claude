import { describe, expect, it } from 'vitest'
import { parsearHistorico } from '../../src/importar/historico'
import { construirHojaHistorico } from '../fixtures/historico'

const bloqueA = {
  tag: ' 11bjc426',
  mecanica: '2x1 en cerveza',
  objetivo: 'Rotación',
  canal: 'WhatsApp',
  inicio: '01/09/2026',
  fin: '30/09/2026',
  filas: [
    {
      id: 900, concesion: 'Auto A', kam: 'Ana', territorio: 'Norte', estado: 'Activa',
      aceptacion: new Date(2026, 8, 3, 10, 15, 0), usos: '18', cupos: '-', gsv: '#VALUE!',
      sms: 'Enviado', email: 'Si',
    },
    { id: 901, concesion: 'Auto B', estado: 'Pendiente', sms: 'Pending', email: 'Pending' },
    { id: 902, concesion: 'Auto C', estado: 'Rechaza', cupos: 20, usos: 5, gsv: 120.5 },
  ],
}
const bloqueB = {
  tag: 'XYZ1',
  mecanica: 'Descuento 10%',
  objetivo: 'Captación',
  canal: 'Email',
  inicio: '15/09/2026',
  fin: '15/10/2026',
  filas: [{ id: 900, estado: 'Activa' }, { id: 903, estado: 'No entra' }],
}

describe('parsearHistorico', () => {
  it('lee dos bloques con TAG, mecánica, canal y fechas', () => {
    const r = parsearHistorico(construirHojaHistorico([bloqueA, bloqueB]))
    expect(r.errores).toEqual([])
    expect(r.promociones).toHaveLength(2)
    const [a, b] = r.promociones
    expect(a).toMatchObject({
      tag: '11BJC426', mecanica: '2x1 en cerveza', objetivo: 'Rotación', canal: 'WhatsApp',
      fechaInicio: '2026-09-01', fechaFin: '2026-09-30',
    })
    expect(a.filas).toHaveLength(3)
    expect(b).toMatchObject({ tag: 'XYZ1', canal: 'Email', fechaInicio: '2026-09-15', fechaFin: '2026-10-15' })
    expect(b.filas.map((f) => f.id)).toEqual([900, 903])
  })

  it('normaliza usos, cupos, GSV, envíos y fechas', () => {
    const [a] = parsearHistorico(construirHojaHistorico([bloqueA])).promociones
    expect(a.filas[0]).toEqual({
      fila: 12, id: 900, concesion: 'Auto A', kam: 'Ana', territorio: 'Norte', estado: 'activa',
      fechaAceptacion: '2026-09-03T10:15:00', fechaActivacion: null,
      cupos: null, usos: 18, gsv: null, sms: 'enviado', email: 'enviado',
    })
    expect(a.filas[1]).toMatchObject({ estado: 'pendiente', sms: 'pending', usos: null })
    expect(a.filas[2]).toMatchObject({ estado: 'rechaza', cupos: 20, usos: 5, gsv: 120.5, sms: null })
  })

  it('un bloque sin TAG da 1 error y el otro se lee igualmente', () => {
    const r = parsearHistorico(construirHojaHistorico([{ ...bloqueA, tag: null }, bloqueB]))
    expect(r.errores).toHaveLength(1)
    expect(r.errores[0].motivo).toMatch(/TAG/)
    expect(r.promociones.map((p) => p.tag)).toEqual(['XYZ1'])
  })

  it('estado desconocido o ID no numérico omiten la fila', () => {
    const r = parsearHistorico(
      construirHojaHistorico([
        {
          ...bloqueB,
          filas: [
            { id: 1, estado: 'Quizá' },
            { id: 'abc', estado: 'Activa' },
            { id: 2, estado: 'Activa' },
          ],
        },
      ]),
    )
    expect(r.errores.map((e) => e.fila)).toEqual([12, 13])
    expect(r.promociones[0].filas.map((f) => f.id)).toEqual([2])
  })

  it('bloque con fechas o mecánica vacías se lee con nulls', () => {
    const r = parsearHistorico(construirHojaHistorico([{ ...bloqueB, mecanica: null, inicio: null }]))
    expect(r.errores).toEqual([])
    expect(r.promociones[0]).toMatchObject({ mecanica: null, fechaInicio: null, fechaFin: '2026-10-15' })
  })

  it('TAG repetido e ID repetido en un bloque son errores', () => {
    const r = parsearHistorico(
      construirHojaHistorico([
        { ...bloqueB, filas: [{ id: 5, estado: 'Activa' }, { id: 5, estado: 'Activa' }] },
        bloqueB,
      ]),
    )
    expect(r.errores).toHaveLength(2)
    expect(r.errores.every((e) => /duplicad/i.test(e.motivo))).toBe(true)
    expect(r.promociones).toHaveLength(1)
    expect(r.promociones[0].filas).toHaveLength(1)
  })

  it('hoja sin bloques da un error', () => {
    const r = parsearHistorico([['a', 'b']])
    expect(r.promociones).toEqual([])
    expect(r.errores).toHaveLength(1)
  })
})
