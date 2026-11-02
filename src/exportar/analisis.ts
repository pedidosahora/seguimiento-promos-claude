import * as XLSX from 'xlsx'
import type { Metricas } from '../analisis/agregar'

/** Columnas de la comparativa; el primer encabezado es el nombre de la dimensión. */
const CABECERA = [
  'Promociones', 'Convocadas', 'Presentadas', 'Aceptadas', 'Activas', 'Pendientes', 'Rechazadas',
  '% aceptación', '% activación', 'Cupos', 'Usos', '% cupos gastados', 'GSV', 'GSV/uso',
]

/** Libro xlsx de una hoja con la tabla comparativa: valores numéricos crudos (proporciones 0–1, vacío si no hay dato). */
export function exportarComparativa(filas: { etiqueta: string; m: Metricas }[], dimension: string): Blob {
  const cuerpo = filas.map(({ etiqueta, m }) => [
    etiqueta, m.promociones, m.convocadas, m.presentadas, m.aceptadas, m.activas, m.pendientes, m.rechazadas,
    m.pctAceptacion, m.pctActivacion, m.cupos, m.usos, m.pctCupos, m.gsv, m.gsvUso,
  ])
  const cab = [dimension, ...CABECERA]
  const ws = XLSX.utils.aoa_to_sheet([cab, ...cuerpo])
  const formatos: Record<number, string> = { 8: '0%', 9: '0%', 12: '0%', 13: '#,##0.00', 14: '#,##0.00' }
  for (let r = 1; r <= filas.length; r++) {
    for (const [c, z] of Object.entries(formatos)) {
      const celda = ws[XLSX.utils.encode_cell({ r, c: Number(c) })]
      if (celda) celda.z = z
    }
  }
  ws['!cols'] = cab.map((_, i) => ({ wch: i === 0 ? 36 : 14 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Comparativa')
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function nombreArchivoAnalisis(dimension: string, hoy = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `analisis-${dimension}-${hoy.getFullYear()}-${p(hoy.getMonth() + 1)}-${p(hoy.getDate())}.xlsx`
}
