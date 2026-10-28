import { gsvPorUso, nivelAlertaCupos, pctCupos } from '../../dominio/calculos'
import type { FilaGrid } from './servicio'

export type CampoEditable =
  | 'estado'
  | 'sms'
  | 'email'
  | 'cupos'
  | 'usos'
  | 'gsv'
  | 'fecha_aceptacion'
  | 'fecha_activacion'
export type CampoGrid = CampoEditable | 'pct_cupos' | 'gsv_uso' | 'concesion' | 'kam' | 'territorio'

export interface ContextoCelda {
  /** El usuario puede editar esta fila (RPC concesiones_editables). */
  editable: boolean
  esAdmin: boolean
  umbral: number
}

const SOLO_ADMIN: CampoGrid[] = ['usos', 'gsv']
const EDITABLES: CampoGrid[] = ['estado', 'sms', 'email', 'cupos', 'usos', 'gsv', 'fecha_aceptacion', 'fecha_activacion']

export function textoPctCupos(usos: number | null, cupos: number | null): string {
  const p = pctCupos(usos, cupos)
  return p == null ? '—' : `${Math.round(p * 100)} %`
}

export function textoGsvUso(gsv: number | null, usos: number | null): string {
  const v = gsvPorUso(gsv, usos)
  return v == null ? '—' : v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export function esEditable(campo: CampoGrid, ctx: Pick<ContextoCelda, 'editable' | 'esAdmin'>): boolean {
  if (!EDITABLES.includes(campo)) return false
  if (SOLO_ADMIN.includes(campo)) return ctx.esAdmin
  return ctx.editable
}

/** Clases CSS de una celda: gris si no se puede editar, ámbar/rojo en %Cupos según el umbral. */
export function claseCelda(campo: CampoGrid, fila: FilaGrid, ctx: ContextoCelda): string {
  const clases: string[] = []
  if (EDITABLES.includes(campo) && !esEditable(campo, ctx)) clases.push('no-editable')
  if (campo === 'pct_cupos') {
    const nivel = nivelAlertaCupos(fila.usos, fila.cupos, ctx.umbral)
    if (nivel) clases.push(`alerta-${nivel}`)
  }
  return clases.join(' ')
}

const ESTADOS = ['no_entra', 'pendiente', 'acepta', 'rechaza', 'activa']
const ENVIOS = ['enviado', 'pending', 'no_hay']

/** Valida y normaliza el valor tecleado antes de enviarlo al servidor. */
export function validarCambio(campo: CampoEditable, valor: unknown): { valor: unknown } | { error: string } {
  switch (campo) {
    case 'estado':
      return ESTADOS.includes(valor as string) ? { valor } : { error: 'Estado no válido' }
    case 'sms':
    case 'email':
      return ENVIOS.includes(valor as string) ? { valor } : { error: 'Valor de envío no válido' }
    case 'cupos':
    case 'usos': {
      if (valor === null || valor === undefined || valor === '') return { valor: null }
      const n = Number(valor)
      if (!Number.isInteger(n) || n < 0) return { error: 'Debe ser un número entero igual o mayor que 0' }
      return { valor: n }
    }
    case 'gsv': {
      if (valor === null || valor === undefined || valor === '') return { valor: null }
      const n = Number(valor)
      if (!Number.isFinite(n) || n < 0) return { error: 'El GSV debe ser un número igual o mayor que 0' }
      return { valor: n }
    }
    default:
      return { valor: valor === '' ? null : valor }
  }
}

const dos = (n: number) => String(n).padStart(2, '0')

/** ISO (timestamptz) → 'aaaa-mm-ddThh:mm' en hora local, formato del editor de fecha y hora. */
export function isoALocal(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`
}

/** 'aaaa-mm-ddThh:mm' local → ISO UTC para guardar. */
export function localAIso(local: string | null): string | null {
  if (!local) return null
  const d = new Date(local)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Texto de una fecha y hora para mostrar. */
export function textoFechaHora(iso: string | null): string {
  const l = isoALocal(iso)
  if (!l) return '—'
  const [f, h] = l.split('T')
  return `${f.split('-').reverse().join('/')} ${h}`
}
