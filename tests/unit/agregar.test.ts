import { describe, expect, it } from 'vitest'
import { agrupar, filtrar, metricas, rellenarMeses, type FilaAnalisis, type Filtros } from '../../src/analisis/agregar'

function fila(o: Partial<FilaAnalisis> = {}): FilaAnalisis {
  return {
    seguimiento_id: 's', estado: 'pendiente', cupos: null, usos: null, gsv: null,
    promocion_id: 'p1', tag: 'T1', espacio: 'TMICC', marca: 'TMICC', canal: null,
    estado_promocion: 'publicada', fecha_inicio: '2026-10-05', concesion_id: 1,
    concesion_nombre: 'C1', territorio: null, kam_id: null, kam_nombre: null, ...o,
  }
}
const sinFiltros: Filtros = {
  espacio: null, marca: null, estados: [], desde: null, hasta: null, kamId: null, territorio: null, soloKamId: null,
}

describe('metricas', () => {
  const filas = [
    fila({ estado: 'no_entra' }),
    fila({ estado: 'acepta', tag: 'T1' }),
    fila({ estado: 'activa', cupos: 10, usos: 8, gsv: 120.5, tag: 'T2' }),
    fila({ estado: 'rechaza' }),
    fila({ estado: 'pendiente' }),
  ]
  it('calcula recuentos y ratios', () => {
    const m = metricas(filas)
    expect(m.promociones).toBe(2)
    expect(m.convocadas).toBe(5)
    expect(m.presentadas).toBe(4)
    expect(m.aceptadas).toBe(2)
    expect(m.activas).toBe(1)
    expect(m.pendientes).toBe(1)
    expect(m.rechazadas).toBe(1)
    expect(m.pctAceptacion).toBe(0.5)
    expect(m.pctActivacion).toBe(0.25)
    expect(m.cupos).toBe(10)
    expect(m.usos).toBe(8)
    expect(m.pctCupos).toBe(0.8)
    expect(m.gsv).toBe(120.5)
    expect(m.gsvUso).toBe(15.0625)
  })
  it('devuelve null sin presentadas, cupos o usos', () => {
    const m = metricas([fila({ estado: 'no_entra' })])
    expect(m.pctAceptacion).toBeNull()
    expect(m.pctActivacion).toBeNull()
    expect(m.pctCupos).toBeNull()
    expect(m.gsvUso).toBeNull()
    expect(metricas([]).convocadas).toBe(0)
  })
})

describe('filtrar', () => {
  it('por espacio, marca y estados de promoción', () => {
    const fs = [
      fila({ seguimiento_id: 'a', espacio: 'UFS', marca: 'UFS' }),
      fila({ seguimiento_id: 'b', estado_promocion: 'cerrada' }),
    ]
    expect(filtrar(fs, { ...sinFiltros, espacio: 'UFS' }).map((f) => f.seguimiento_id)).toEqual(['a'])
    expect(filtrar(fs, { ...sinFiltros, marca: 'TMICC' }).map((f) => f.seguimiento_id)).toEqual(['b'])
    expect(filtrar(fs, { ...sinFiltros, estados: ['cerrada'] }).map((f) => f.seguimiento_id)).toEqual(['b'])
  })
  it('rango de fechas inclusive; sin fecha solo se excluye con filtro', () => {
    const fs = [
      fila({ seguimiento_id: 'a', fecha_inicio: '2026-10-01' }),
      fila({ seguimiento_id: 'b', fecha_inicio: '2026-10-31' }),
      fila({ seguimiento_id: 'c', fecha_inicio: '2026-11-01' }),
      fila({ seguimiento_id: 'd', fecha_inicio: null }),
    ]
    const ids = (f: Filtros) => filtrar(fs, f).map((x) => x.seguimiento_id)
    expect(ids({ ...sinFiltros, desde: '2026-10-01', hasta: '2026-10-31' })).toEqual(['a', 'b'])
    expect(ids({ ...sinFiltros, hasta: '2026-10-31' })).toEqual(['a', 'b'])
    expect(ids(sinFiltros)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('por kam, territorio y soloKamId', () => {
    const fs = [
      fila({ seguimiento_id: 'a', kam_id: 'k1', territorio: 'Norte' }),
      fila({ seguimiento_id: 'b', kam_id: 'k2', territorio: 'Sur' }),
    ]
    expect(filtrar(fs, { ...sinFiltros, kamId: 'k2' }).map((f) => f.seguimiento_id)).toEqual(['b'])
    expect(filtrar(fs, { ...sinFiltros, territorio: 'Norte' }).map((f) => f.seguimiento_id)).toEqual(['a'])
    expect(filtrar(fs, { ...sinFiltros, soloKamId: 'k1' }).map((f) => f.seguimiento_id)).toEqual(['a'])
  })
})

describe('agrupar', () => {
  it('por kam con «Sin KAM»', () => {
    const g = agrupar(
      [fila({ kam_id: 'k1', kam_nombre: 'Ana' }), fila({ kam_id: null }), fila({ kam_id: 'k1', kam_nombre: 'Ana' })],
      'kam',
    )
    const ana = g.find((x) => x.clave === 'k1')
    expect(ana?.etiqueta).toBe('Ana')
    expect(ana?.m.convocadas).toBe(2)
    expect(g.find((x) => x.etiqueta === 'Sin KAM')?.m.convocadas).toBe(1)
  })
  it('por mes ordenado por clave, con «Sin fecha»', () => {
    const g = agrupar(
      [fila({ fecha_inicio: '2026-11-03' }), fila({ fecha_inicio: '2026-10-05' }), fila({ fecha_inicio: null })],
      'mes',
    )
    expect(g.map((x) => x.clave)).toEqual(['2026-10', '2026-11', 'sin-fecha'])
    expect(g[0].etiqueta).toBe('oct 2026')
    expect(g[2].etiqueta).toBe('Sin fecha')
  })
  it('por territorio, canal, promoción, espacio, marca y concesión', () => {
    const fs = [fila({ territorio: null, canal: null })]
    expect(agrupar(fs, 'territorio')[0].etiqueta).toBe('Sin territorio')
    expect(agrupar(fs, 'canal')[0].etiqueta).toBe('Sin canal')
    expect(agrupar(fs, 'promocion')[0].etiqueta).toBe('T1')
    expect(agrupar(fs, 'espacio')[0].etiqueta).toBe('TMICC')
    expect(agrupar(fs, 'marca')[0].etiqueta).toBe('TMICC')
    expect(agrupar(fs, 'concesion')[0].etiqueta).toBe('C1')
  })
})

describe('rellenarMeses', () => {
  const g = (f: string) => agrupar([fila({ fecha_inicio: f, estado: 'activa', gsv: 50, usos: 3 })], 'mes')[0]
  it('rellena con ceros los meses sin datos', () => {
    const r = rellenarMeses([g('2026-01-10'), g('2026-03-02')])
    expect(r.map((x) => x.clave)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(r[1].m.gsv).toBe(0)
    expect(r[1].m.usos).toBe(0)
    expect(r[1].etiqueta).toBe('feb 2026')
    expect(r[0].m.gsv).toBe(50)
  })
  it('cruza el cambio de año', () => {
    const r = rellenarMeses([g('2026-11-01'), g('2027-02-01')])
    expect(r.map((x) => x.clave)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })
  it('vacío y «sin fecha» no generan meses', () => {
    expect(rellenarMeses([])).toEqual([])
    expect(rellenarMeses(agrupar([fila({ fecha_inicio: null })], 'mes'))).toEqual([])
  })
})
