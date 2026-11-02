import type { Espacio, EstadoPromocion, EstadoSeguimiento } from '../dominio/etiquetas'

export type FilaAnalisis = {
  seguimiento_id: string
  estado: EstadoSeguimiento
  cupos: number | null
  usos: number | null
  gsv: number | null
  promocion_id: string
  tag: string
  espacio: Espacio
  marca: 'TMICC' | 'UFS'
  canal: string | null
  estado_promocion: EstadoPromocion
  fecha_inicio: string | null
  concesion_id: number
  concesion_nombre: string
  territorio: string | null
  kam_id: string | null
  kam_nombre: string | null
}

export type Filtros = {
  espacio: Espacio | null
  marca: 'TMICC' | 'UFS' | null
  estados: EstadoPromocion[]
  desde: string | null
  hasta: string | null
  kamId: string | null
  territorio: string | null
  soloKamId: string | null
}

export type Metricas = {
  promociones: number
  convocadas: number
  presentadas: number
  aceptadas: number
  activas: number
  pendientes: number
  rechazadas: number
  pctAceptacion: number | null
  pctActivacion: number | null
  cupos: number
  usos: number
  pctCupos: number | null
  gsv: number
  gsvUso: number | null
}

export type Dimension = 'promocion' | 'kam' | 'territorio' | 'concesion' | 'espacio' | 'marca' | 'canal' | 'mes'

/** Filtra en el navegador. Fechas por fecha_inicio inclusive; sin fecha_inicio se excluye solo si hay desde o hasta. */
export function filtrar(filas: FilaAnalisis[], f: Filtros): FilaAnalisis[] {
  return filas.filter((x) => {
    if (f.espacio && x.espacio !== f.espacio) return false
    if (f.marca && x.marca !== f.marca) return false
    if (f.estados.length > 0 && !f.estados.includes(x.estado_promocion)) return false
    if (f.desde || f.hasta) {
      if (!x.fecha_inicio) return false
      if (f.desde && x.fecha_inicio < f.desde) return false
      if (f.hasta && x.fecha_inicio > f.hasta) return false
    }
    if (f.kamId && x.kam_id !== f.kamId) return false
    if (f.territorio && x.territorio !== f.territorio) return false
    if (f.soloKamId && x.kam_id !== f.soloKamId) return false
    return true
  })
}

const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null)

/** Mismas definiciones que v_resumen_promocion. */
export function metricas(filas: FilaAnalisis[]): Metricas {
  let presentadas = 0
  let aceptadas = 0
  let activas = 0
  let pendientes = 0
  let rechazadas = 0
  let cupos = 0
  let usos = 0
  let gsv = 0
  const tags = new Set<string>()
  for (const f of filas) {
    tags.add(f.tag)
    if (f.estado !== 'no_entra') presentadas++
    if (f.estado === 'acepta' || f.estado === 'activa') aceptadas++
    if (f.estado === 'activa') activas++
    if (f.estado === 'pendiente') pendientes++
    if (f.estado === 'rechaza') rechazadas++
    cupos += f.cupos ?? 0
    usos += f.usos ?? 0
    gsv += f.gsv ?? 0
  }
  return {
    promociones: tags.size,
    convocadas: filas.length,
    presentadas,
    aceptadas,
    activas,
    pendientes,
    rechazadas,
    pctAceptacion: ratio(aceptadas, presentadas),
    pctActivacion: ratio(activas, presentadas),
    cupos,
    usos,
    pctCupos: ratio(usos, cupos),
    gsv,
    gsvUso: ratio(gsv, usos),
  }
}

const MESES = new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric', timeZone: 'UTC' })

function etiquetaMes(clave: string): string {
  const [a, m] = clave.split('-').map(Number)
  // «oct 2026»: se normaliza por si el runtime añade punto o «de».
  return MESES.format(new Date(Date.UTC(a, m - 1, 1)))
    .replace(/\./g, '')
    .replace(' de ', ' ')
}

function claveEtiqueta(f: FilaAnalisis, d: Dimension): { clave: string; etiqueta: string } {
  switch (d) {
    case 'promocion':
      return { clave: f.promocion_id, etiqueta: f.tag }
    case 'kam':
      return f.kam_id ? { clave: f.kam_id, etiqueta: f.kam_nombre ?? 'Sin KAM' } : { clave: 'sin-kam', etiqueta: 'Sin KAM' }
    case 'territorio':
      return f.territorio ? { clave: f.territorio, etiqueta: f.territorio } : { clave: 'sin-territorio', etiqueta: 'Sin territorio' }
    case 'concesion':
      return { clave: String(f.concesion_id), etiqueta: f.concesion_nombre }
    case 'espacio':
      return { clave: f.espacio, etiqueta: f.espacio }
    case 'marca':
      return { clave: f.marca, etiqueta: f.marca }
    case 'canal':
      return f.canal ? { clave: f.canal, etiqueta: f.canal } : { clave: 'sin-canal', etiqueta: 'Sin canal' }
    case 'mes': {
      if (!f.fecha_inicio) return { clave: 'sin-fecha', etiqueta: 'Sin fecha' }
      const clave = f.fecha_inicio.slice(0, 7)
      return { clave, etiqueta: etiquetaMes(clave) }
    }
  }
}

/** Todos los meses entre el primero y el último presentes (aaaa-mm), con métricas a cero en los que faltan. Ignora «sin-fecha». */
export function rellenarMeses<T extends { clave: string; etiqueta: string; m: Metricas }>(
  grupos: T[],
): { clave: string; etiqueta: string; m: Metricas }[] {
  const porClave = new Map(grupos.filter((g) => /^\d{4}-\d{2}$/.test(g.clave)).map((g) => [g.clave, g]))
  if (porClave.size === 0) return []
  const claves = [...porClave.keys()].sort()
  const [a0, m0] = claves[0].split('-').map(Number)
  const [a1, m1] = claves[claves.length - 1].split('-').map(Number)
  const res: { clave: string; etiqueta: string; m: Metricas }[] = []
  for (let n = a0 * 12 + (m0 - 1); n <= a1 * 12 + (m1 - 1); n++) {
    const clave = `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`
    res.push(porClave.get(clave) ?? { clave, etiqueta: etiquetaMes(clave), m: metricas([]) })
  }
  return res
}

/** Agrupa y calcula métricas por grupo. Para «mes», ordenado por clave (cronológico, «Sin fecha» al final). */
export function agrupar(
  filas: FilaAnalisis[],
  d: Dimension,
): { clave: string; etiqueta: string; m: Metricas }[] {
  const grupos = new Map<string, { etiqueta: string; filas: FilaAnalisis[] }>()
  for (const f of filas) {
    const { clave, etiqueta } = claveEtiqueta(f, d)
    const g = grupos.get(clave)
    if (g) g.filas.push(f)
    else grupos.set(clave, { etiqueta, filas: [f] })
  }
  const res = [...grupos].map(([clave, g]) => ({ clave, etiqueta: g.etiqueta, m: metricas(g.filas) }))
  if (d === 'mes') {
    res.sort((a, b) => (a.clave === 'sin-fecha' ? 1 : b.clave === 'sin-fecha' ? -1 : a.clave.localeCompare(b.clave)))
  }
  return res
}
