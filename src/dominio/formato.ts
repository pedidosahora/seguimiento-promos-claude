// Formateo numérico único de la app (es-ES, separador de miles siempre).
const SIN_DATO = '—'
// 'always' fuerza «1.260» también con 4 cifras (es-ES lo omitiría por defecto); aún no está en los tipos de lib.
const AGRUPAR = 'always' as unknown as boolean

const entero = new Intl.NumberFormat('es-ES', {
  useGrouping: AGRUPAR,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const importe = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  useGrouping: AGRUPAR,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const vacio = (v: unknown) => v == null || v === ''

export function fmtEntero(v: number | null | undefined): string {
  return vacio(v) ? SIN_DATO : entero.format(Number(v))
}

export function fmtImporte(v: number | string | null | undefined): string {
  return vacio(v) ? SIN_DATO : importe.format(Number(v))
}

/** Recibe una proporción: 0.84 → «84 %». */
export function fmtPct(v: number | null | undefined): string {
  return vacio(v) ? SIN_DATO : `${entero.format(Math.round(Number(v) * 100))} %`
}
