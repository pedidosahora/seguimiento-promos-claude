import { parsearHistorico } from './historico'
import { aFechaISO, aId, aNumero, normalizarCabecera, normalizarTag } from './normalizar'
import type { ErrorFila } from './tipos'

export type { ErrorFila }
export type FilaUsos = {
  fila: number
  id: number
  concesion: string
  tag: string
  usos: number
  gsv: number
  fecha: string
}

const INT4_MAX = 2147483647
const GSV_MAX = 9999999999.99 // numeric(12,2)

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

export function parsearUsos(aoa: unknown[][]): { filas: FilaUsos[]; errores: ErrorFila[] } {
  const filas: FilaUsos[] = []
  const errores: ErrorFila[] = []
  const cab = (aoa[0] ?? []).map(normalizarCabecera)
  const [cId, cCon, cTag, cUsos, cGsv, cFecha] = [
    'id',
    'concesion',
    'tag',
    'usos',
    'gsv',
    'fechaactualizacion',
  ].map((n) => cab.indexOf(n))
  if ([cId, cCon, cTag, cUsos, cGsv, cFecha].some((c) => c < 0)) {
    const esHistorico = parsearHistorico(aoa).promociones.length > 0
    return {
      filas,
      errores: [
        {
          fila: 1,
          motivo: esHistorico
            ? 'Este archivo es un histórico de seguimiento (bloques por promoción). Elige «Histórico de seguimiento» en Tipo de importación.'
            : 'Faltan columnas: ID, CONCESION, TAG, USOS, GSV, FECHA ACTUALIZACION',
        },
      ],
    }
  }
  const vistos = new Set<string>()
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i] ?? []
    const fila = i + 1
    if (r.every((c) => texto(c) === '')) continue
    const id = aId(r[cId])
    if (id === null) {
      errores.push({ fila, motivo: 'ID vacío' })
      continue
    }
    if (Number.isNaN(id)) {
      errores.push({ fila, motivo: `ID no válido: ${texto(r[cId])}` })
      continue
    }
    const tag = normalizarTag(r[cTag])
    if (tag === null) {
      errores.push({ fila, motivo: 'Fila sin TAG' })
      continue
    }
    const usos = aNumero(r[cUsos])
    if (usos === null || Number.isNaN(usos) || usos < 0 || !Number.isInteger(usos) || usos > INT4_MAX) {
      errores.push({ fila, motivo: 'Usos no numérico' })
      continue
    }
    const gsv = aNumero(r[cGsv])
    if (gsv === null || Number.isNaN(gsv) || gsv < 0 || gsv > GSV_MAX) {
      errores.push({ fila, motivo: 'GSV no numérico' })
      continue
    }
    const fecha = aFechaISO(r[cFecha])
    if (fecha === null || fecha === undefined) {
      errores.push({ fila, motivo: 'Fecha no válida' })
      continue
    }
    const clave = `${tag}|${id}`
    if (vistos.has(clave)) {
      errores.push({ fila, motivo: 'Fila duplicada (ID + TAG)' })
      continue
    }
    vistos.add(clave)
    filas.push({ fila, id, concesion: texto(r[cCon]), tag, usos, gsv, fecha })
  }
  return { filas, errores }
}
