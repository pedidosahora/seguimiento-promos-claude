import { aId, normalizarCabecera } from './normalizar'
import type { ErrorFila } from './tipos'

export type { ErrorFila }
export type FilaConcesion = {
  fila: number
  id: number
  razonSocial: string
  kam: string
  territorio: string
}

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

export function parsearConcesiones(aoa: unknown[][]): {
  filas: FilaConcesion[]
  errores: ErrorFila[]
} {
  const filas: FilaConcesion[] = []
  const errores: ErrorFila[] = []
  const cab = (aoa[0] ?? []).map(normalizarCabecera)
  const [cId, cCon, cKam, cTer] = ['id', 'concesion', 'kampro', 'territorio'].map((n) =>
    cab.indexOf(n),
  )
  if ([cId, cCon, cKam, cTer].some((c) => c < 0)) {
    return {
      filas,
      errores: [{ fila: 1, motivo: 'Faltan columnas: ID, CONCESION, KAM PRO, TERRITORIO' }],
    }
  }
  const vistos = new Set<number>()
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
    if (vistos.has(id)) {
      errores.push({ fila, motivo: 'ID duplicado' })
      continue
    }
    vistos.add(id)
    filas.push({
      fila,
      id,
      razonSocial: texto(r[cCon]),
      kam: texto(r[cKam]),
      territorio: texto(r[cTer]),
    })
  }
  return { filas, errores }
}
