import type { Database } from '../lib/database.types'
import { nivelAlertaCupos } from './calculos'

export type FilaInicio = Database['public']['Views']['v_inicio_filas']['Row']

export type Tarea = 'sin_respuesta' | 'sin_activar' | 'cupos' | 'revision' | 'envios'

export const TAREAS: { clave: Tarea; etiqueta: string }[] = [
  { clave: 'sin_respuesta', etiqueta: 'Sin respuesta' },
  { clave: 'sin_activar', etiqueta: 'Aceptadas sin activar' },
  { clave: 'cupos', etiqueta: 'Cupos al límite' },
  { clave: 'revision', etiqueta: 'Revisión semanal' },
  { clave: 'envios', etiqueta: 'Envíos pendientes' },
]

const DIA_MS = 24 * 60 * 60 * 1000
const PERIODO_DIAS = { semanal: 7, quincenal: 14 } as const

function revisionPendiente(f: FilaInicio, ahora: Date): boolean {
  if (f.estado !== 'activa' || f.revision_cupos === 'ninguna') return false
  if (f.cupos_revisado_en == null) return true
  const limite = ahora.getTime() - PERIODO_DIAS[f.revision_cupos] * DIA_MS
  return new Date(f.cupos_revisado_en).getTime() < limite
}

function cuposAlLimite(f: FilaInicio): boolean {
  if (f.estado !== 'acepta' && f.estado !== 'activa') return false
  return nivelAlertaCupos(f.usos, f.cupos, Number(f.umbral_cupos)) !== null
}

export function tareasDeFila(f: FilaInicio, ahora: Date): Tarea[] {
  const tareas: Tarea[] = []
  if (f.estado === 'pendiente') tareas.push('sin_respuesta')
  if (f.estado === 'acepta') tareas.push('sin_activar')
  if (cuposAlLimite(f)) tareas.push('cupos')
  if (revisionPendiente(f, ahora)) tareas.push('revision')
  const vivo = f.estado !== 'no_entra' && f.estado !== 'rechaza'
  if (vivo && (f.sms === 'pending' || f.email === 'pending')) tareas.push('envios')
  return tareas
}

export function contarTareas(filas: FilaInicio[], ahora: Date): Record<Tarea, number> {
  const cuenta: Record<Tarea, number> = {
    sin_respuesta: 0,
    sin_activar: 0,
    cupos: 0,
    revision: 0,
    envios: 0,
  }
  for (const f of filas) for (const t of tareasDeFila(f, ahora)) cuenta[t]++
  return cuenta
}

export function hayAgotadas(filas: FilaInicio[]): boolean {
  return filas.some(
    (f) =>
      (f.estado === 'acepta' || f.estado === 'activa') &&
      f.cupos != null &&
      f.cupos > 0 &&
      f.usos != null &&
      f.usos >= f.cupos,
  )
}
