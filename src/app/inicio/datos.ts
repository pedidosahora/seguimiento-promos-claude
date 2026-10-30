import { supabase } from '../../lib/supabase'
import type { Espacio } from '../../dominio/etiquetas'
import type { FilaInicio } from '../../dominio/tareas'
import { guardarFila, type Cambios } from '../promocion/servicio'

/** Todas las filas de seguimiento de promociones publicadas visibles para el usuario. */
export async function cargarFilasInicio(): Promise<FilaInicio[]> {
  const { data, error } = await supabase.from('v_inicio_filas').select('*')
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Relee una fila del inicio; null si ya no existe. */
export async function recargarFila(seguimientoId: string): Promise<FilaInicio | null> {
  const { data, error } = await supabase
    .from('v_inicio_filas')
    .select('*')
    .eq('seguimiento_id', seguimientoId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** Guarda con control de versión y devuelve la fila del inicio con los datos guardados. */
export async function guardarDesdeInicio(f: FilaInicio, cambios: Cambios): Promise<FilaInicio> {
  const g = await guardarFila(f.seguimiento_id, cambios, f.actualizado_en)
  return {
    ...f,
    estado: g.estado,
    cupos: g.cupos,
    sms: g.sms,
    email: g.email,
    cupos_revisado_en: g.cupos_revisado_en,
    actualizado_en: g.actualizado_en,
  }
}

export function rutaPromocion(espacio: Espacio, tag: string): string {
  const base = { TMICC: 'tmicc', UFS: 'ufs', CAMPANAS: 'campanas' }[espacio]
  return `/${base}/${tag}`
}
