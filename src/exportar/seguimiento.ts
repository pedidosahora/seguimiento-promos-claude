import * as XLSX from 'xlsx'
import { gsvPorUso, pctCupos } from '../dominio/calculos'
import { ETIQUETA_ENVIO, ETIQUETA_ESTADO } from '../dominio/etiquetas'
import type { FilaGrid } from '../app/promocion/servicio'

export type FilaSeguimiento = FilaGrid
export type Promocion = { tag: string }

const CABECERA = [
  'ID', 'Concesión', 'KAM', 'Territorio', 'Estado', 'Aceptación', 'Activación',
  'Cupos', 'Usos', '%Cupos', 'GSV', 'GSV/uso', 'SMS', 'Email',
]

const fecha = (iso: string | null) => (iso ? new Date(iso) : null)

/** Libro xlsx con la tabla de seguimiento: números como número, etiquetas visibles. */
export function exportarSeguimiento(_promo: Promocion, filas: FilaSeguimiento[]): Blob {
  const cuerpo = filas.map((f) => [
    f.concesion_id,
    f.nombre,
    f.kam_nombre,
    f.territorio,
    ETIQUETA_ESTADO[f.estado],
    fecha(f.fecha_aceptacion),
    fecha(f.fecha_activacion),
    f.cupos,
    f.usos,
    pctCupos(f.usos, f.cupos),
    f.gsv,
    gsvPorUso(f.gsv, f.usos),
    ETIQUETA_ENVIO[f.sms],
    ETIQUETA_ENVIO[f.email],
  ])
  const ws = XLSX.utils.aoa_to_sheet([CABECERA, ...cuerpo], { cellDates: true })
  const formatos: Record<number, string> = {
    5: 'dd/mm/yyyy hh:mm', 6: 'dd/mm/yyyy hh:mm', 9: '0%', 10: '#,##0.00', 11: '#,##0.00',
  }
  for (let r = 1; r <= filas.length; r++) {
    for (const [c, z] of Object.entries(formatos)) {
      const celda = ws[XLSX.utils.encode_cell({ r, c: Number(c) })]
      if (celda) celda.z = z
    }
  }
  ws['!cols'] = CABECERA.map((_, i) => ({ wch: i === 1 ? 36 : 14 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Seguimiento')
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true }) as ArrayBuffer
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function nombreArchivoSeguimiento(tag: string, hoy = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${tag}_seguimiento_${hoy.getFullYear()}-${p(hoy.getMonth() + 1)}-${p(hoy.getDate())}.xlsx`
}

/** Descarga el Blob con un enlace temporal. */
export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
