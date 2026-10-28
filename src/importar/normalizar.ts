import type { Database } from '../lib/database.types'

export type EstadoSeguimiento = Database['public']['Enums']['estado_seguimiento']
export type EstadoEnvio = Database['public']['Enums']['estado_envio']

const VACIOS = new Set(['', '-', '—'])

/** number | texto → number. null si vacío/error de Excel; NaN si no es numérico. */
export function aNumero(v: unknown): number | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return v
  const t = String(v).trim()
  if (VACIOS.has(t) || t.startsWith('#')) return null
  let s = t
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN
  return Number(s)
}

const dos = (n: number) => String(n).padStart(2, '0')

/** Serie de Excel → partes de fecha (epoch 1899-12-30), sin zona horaria. */
function desdeSerie(n: number) {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000))
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
    s: d.getUTCSeconds(),
  }
}

export function aFechaISO(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null
    return `${v.getFullYear()}-${dos(v.getMonth() + 1)}-${dos(v.getDate())}`
  }
  if (typeof v === 'number') {
    const p = desdeSerie(v)
    return `${p.y}-${dos(p.m)}-${dos(p.d)}`
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v).trim())
  if (!m) return null
  return `${m[3]}-${dos(Number(m[2]))}-${dos(Number(m[1]))}`
}

/** Fecha con hora → ISO completo (partes locales del Date, sin desplazar zona). */
export function aFechaHoraISO(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null
    return `${v.getFullYear()}-${dos(v.getMonth() + 1)}-${dos(v.getDate())}T${dos(v.getHours())}:${dos(v.getMinutes())}:${dos(v.getSeconds())}`
  }
  if (typeof v === 'number') {
    const p = desdeSerie(v)
    return `${p.y}-${dos(p.m)}-${dos(p.d)}T${dos(p.h)}:${dos(p.mi)}:${dos(p.s)}`
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
    String(v).trim(),
  )
  if (!m) return null
  return `${m[3]}-${dos(Number(m[2]))}-${dos(Number(m[1]))}T${dos(Number(m[4] ?? 0))}:${m[5] ?? '00'}:${m[6] ?? '00'}`
}

export function normalizarTag(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const t = String(v).trim().toUpperCase()
  return t === '' ? null : t
}

export function normalizarCabecera(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/➤/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

const ESTADOS: Record<string, EstadoSeguimiento> = {
  'no entra': 'no_entra',
  pendiente: 'pendiente',
  acepta: 'acepta',
  rechaza: 'rechaza',
  activa: 'activa',
}
const ENVIOS: Record<string, EstadoEnvio> = {
  enviado: 'enviado',
  si: 'enviado',
  pending: 'pending',
  'no hay': 'no_hay',
}

const clave = (v: unknown) => String(v ?? '').trim().toLowerCase()

export function mapearEstado(v: unknown): EstadoSeguimiento | null {
  return ESTADOS[clave(v)] ?? null
}
export function mapearEnvio(v: unknown): EstadoEnvio | null {
  return ENVIOS[clave(v)] ?? null
}
