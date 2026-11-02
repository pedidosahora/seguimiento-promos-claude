import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { exportarComparativa, nombreArchivoAnalisis } from '../../src/exportar/analisis'
import { metricas, type FilaAnalisis } from '../../src/analisis/agregar'

const f = (p: Partial<FilaAnalisis>): FilaAnalisis => ({
  seguimiento_id: 's', estado: 'activa', cupos: 10, usos: 4, gsv: 100.5, promocion_id: 'p1', tag: 'T1',
  espacio: 'TMICC', marca: 'TMICC', canal: null, estado_promocion: 'publicada', fecha_inicio: '2026-10-01',
  concesion_id: 1, concesion_nombre: 'Bar', territorio: null, kam_id: null, kam_nombre: null, ...p,
})

async function leer(blob: Blob) {
  const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' })
  return { wb, filas: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 }) }
}

describe('exportarComparativa', () => {
  it('una hoja con cabeceras en castellano y valores numéricos crudos', async () => {
    const { wb, filas } = await leer(exportarComparativa([{ etiqueta: 'T1', m: metricas([f({})]) }], 'Promoción'))
    expect(wb.SheetNames).toHaveLength(1)
    expect(filas[0]).toEqual([
      'Promoción', 'Promociones', 'Convocadas', 'Presentadas', 'Aceptadas', 'Activas', 'Pendientes', 'Rechazadas',
      '% aceptación', '% activación', 'Cupos', 'Usos', '% cupos gastados', 'GSV', 'GSV/uso',
    ])
    expect(filas[1]).toEqual(['T1', 1, 1, 1, 1, 1, 0, 0, 1, 1, 10, 4, 0.4, 100.5, 25.125])
  })

  it('incluye aceptadas y rechazadas y los formatos caen en su columna', async () => {
    const m = metricas([f({ estado: 'acepta' }), f({ estado: 'rechaza' }), f({ estado: 'activa' })])
    const blob = exportarComparativa([{ etiqueta: 'T1', m }], 'Promoción')
    const { filas } = await leer(blob)
    expect(filas[1]![4]).toBe(2)
    expect(filas[1]![7]).toBe(1)
    const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array', cellNF: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const z = (c: number) => ws[XLSX.utils.encode_cell({ r: 1, c })].z
    expect([8, 9, 12].map(z)).toEqual(['0%', '0%', '0%'])
    expect([13, 14].map(z)).toEqual(['#,##0.00', '#,##0.00'])
    expect([4, 7, 10, 11].map(z)).not.toContain('0%')
  })

  it('porcentajes sin dato quedan vacíos', async () => {
    const { filas } = await leer(exportarComparativa([{ etiqueta: 'X', m: metricas([]) }], 'KAM'))
    expect(filas[0]![0]).toBe('KAM')
    expect(filas[1]![8]).toBeUndefined()
  })
})

describe('nombreArchivoAnalisis', () => {
  it('analisis-<dimension>-aaaa-mm-dd.xlsx', () => {
    expect(nombreArchivoAnalisis('kam', new Date(2026, 10, 2))).toBe('analisis-kam-2026-11-02.xlsx')
  })
})
