import {
  aFechaHoraISO,
  aFechaISO,
  aId,
  aNumero,
  mapearEnvio,
  mapearEstado,
  normalizarCabecera,
  normalizarTag,
  type EstadoEnvio,
  type EstadoSeguimiento,
} from './normalizar'
import type { ErrorFila } from './tipos'

export type { ErrorFila }

export type FilaHistorica = {
  fila: number
  id: number
  concesion: string
  kam: string
  territorio: string
  estado: EstadoSeguimiento
  fechaAceptacion: string | null
  fechaActivacion: string | null
  cupos: number | null
  usos: number | null
  gsv: number | null
  sms: EstadoEnvio | null
  email: EstadoEnvio | null
}

export type PromocionHistorica = {
  tag: string
  mecanica: string | null
  objetivo: string | null
  canal: string | null
  fechaInicio: string | null
  fechaFin: string | null
  filas: FilaHistorica[]
}

const INT4_MAX = 2147483647
const GSV_MAX = 9999999999.99 // numeric(12,2)

const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())
const textoONull = (v: unknown) => texto(v) || null

/** Entero >= 0 dentro de int4. null = vacío o error de Excel; undefined = no válido. */
function entero(v: unknown): number | null | undefined {
  const n = aNumero(v)
  if (n === null) return null
  if (Number.isNaN(n) || n < 0 || !Number.isInteger(n) || n > INT4_MAX) return undefined
  return n
}

function importe(v: unknown): number | null | undefined {
  const n = aNumero(v)
  if (n === null) return null
  if (Number.isNaN(n) || n < 0 || n > GSV_MAX) return undefined
  return n
}

const ETIQUETAS = ['fechas', 'mecanica', 'objetivo', 'canal', 'tag'] as const
type Etiqueta = (typeof ETIQUETAS)[number]

/**
 * Hoja de seguimiento en bloques horizontales de 15 columnas (uno por promoción).
 * Los bloques se localizan por contenido ('ID' en la columna c y '➤Status' en c+4),
 * no por posición fija.
 */
export function parsearHistorico(aoa: unknown[][]): {
  promociones: PromocionHistorica[]
  errores: ErrorFila[]
} {
  const promociones: PromocionHistorica[] = []
  const errores: ErrorFila[] = []
  const celda = (r: number, c: number): unknown => aoa[r]?.[c] ?? null
  const norm = (r: number, c: number) => normalizarCabecera(celda(r, c))

  const cabeceras: { h: number; c: number }[] = []
  for (let h = 0; h < aoa.length; h++) {
    const ancho = aoa[h]?.length ?? 0
    for (let c = 0; c < ancho; c++) {
      if (norm(h, c) === 'id' && norm(h, c + 4) === 'status') cabeceras.push({ h, c })
    }
  }
  if (cabeceras.length === 0) {
    return { promociones, errores: [{ fila: 1, motivo: 'No se encontró ningún bloque (ID … ➤Status)' }] }
  }
  cabeceras.sort((a, b) => a.c - b.c || a.h - b.h)

  const tagsVistos = new Set<string>()
  for (const { h, c } of cabeceras) {
    // Etiquetas por encima de la cabecera, en c+4 (la más cercana a la cabecera).
    const pos: Partial<Record<Etiqueta, number>> = {}
    for (let r = h - 1; r >= 0; r--) {
      const e = norm(r, c + 4) as Etiqueta
      if ((ETIQUETAS as readonly string[]).includes(e) && pos[e] === undefined) pos[e] = r
    }
    const valor = (e: Exclude<Etiqueta, 'fechas'>) =>
      pos[e] === undefined ? null : textoONull(celda(pos[e]!, c + 5))
    // Fecha inválida → null; el aviso de borrador sale en la previsualización.
    const fecha = (col: number) =>
      pos.fechas === undefined ? null : (aFechaISO(celda(pos.fechas, col)) ?? null)

    const tag = normalizarTag(pos.tag === undefined ? null : celda(pos.tag, c + 5))
    if (tag === null) {
      errores.push({ fila: (pos.tag ?? h) + 1, motivo: `Bloque sin TAG (columna ${c + 1})` })
      continue
    }
    if (tagsVistos.has(tag)) {
      errores.push({ fila: (pos.tag ?? h) + 1, motivo: `TAG duplicado en el archivo: ${tag}` })
      continue
    }
    tagsVistos.add(tag)

    const filas: FilaHistorica[] = []
    const ids = new Set<number>()
    for (let r = h + 1; r < aoa.length; r++) {
      if (texto(celda(r, c)) === '') break
      const fila = r + 1
      const id = aId(celda(r, c))
      if (id === null || Number.isNaN(id)) {
        errores.push({ fila, motivo: `ID no válido: ${texto(celda(r, c))} (${tag})` })
        continue
      }
      const estado = mapearEstado(celda(r, c + 4))
      if (estado === null) {
        errores.push({ fila, motivo: `Estado no reconocido: ${texto(celda(r, c + 4))} (${tag})` })
        continue
      }
      if (ids.has(id)) {
        errores.push({ fila, motivo: `Fila duplicada: ID ${id} repetido en ${tag}` })
        continue
      }
      const aceptacion = aFechaHoraISO(celda(r, c + 5))
      const activacion = aFechaHoraISO(celda(r, c + 6))
      const cupos = entero(celda(r, c + 7))
      const usos = entero(celda(r, c + 8))
      const gsv = importe(celda(r, c + 10))
      if (
        aceptacion === undefined || activacion === undefined ||
        cupos === undefined || usos === undefined || gsv === undefined
      ) {
        const que =
          aceptacion === undefined ? 'Fecha de aceptación no válida'
          : activacion === undefined ? 'Fecha de activación no válida'
          : cupos === undefined ? 'Cupos no válidos'
          : usos === undefined ? 'Usos no válidos'
          : 'GSV no válido'
        errores.push({ fila, motivo: `${que} (${tag})` })
        continue
      }
      ids.add(id)
      filas.push({
        fila,
        id,
        concesion: texto(celda(r, c + 1)),
        kam: texto(celda(r, c + 2)),
        territorio: texto(celda(r, c + 3)),
        estado,
        fechaAceptacion: aceptacion,
        fechaActivacion: activacion,
        cupos,
        usos,
        gsv,
        sms: mapearEnvio(celda(r, c + 12)),
        email: mapearEnvio(celda(r, c + 13)),
      })
    }

    promociones.push({
      tag,
      mecanica: valor('mecanica'),
      objetivo: valor('objetivo'),
      canal: valor('canal'),
      fechaInicio: fecha(c + 5),
      fechaFin: fecha(c + 6),
      filas,
    })
  }
  return { promociones, errores }
}
