import * as XLSX from 'xlsx'

/** Primera hoja del libro como matriz de filas (celdas vacías = null). */
export function leerHoja(buf: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(buf, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  })
}
