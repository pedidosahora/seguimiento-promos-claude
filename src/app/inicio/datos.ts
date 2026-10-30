import type { SupabaseClient } from '@supabase/supabase-js'
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

/** Concesiones del perfil: titular o con permiso extra vigente por concesión (los permisos por espacio no cuentan). */
export async function cargarMisConcesiones(
  perfilId: string,
  cliente: SupabaseClient = supabase,
): Promise<{ id: number; nombre: string }[]> {
  const hoy = new Date().toISOString().slice(0, 10)
  const [propias, permisos] = await Promise.all([
    cliente.from('concesiones').select('id, razon_social, nombre_comercial').eq('kam_id', perfilId),
    cliente
      .from('permisos_extra')
      .select('concesion_id, caduca')
      .eq('perfil_id', perfilId)
      .not('concesion_id', 'is', null)
      .or(`caduca.is.null,caduca.gte.${hoy}`),
  ])
  if (propias.error) throw new Error(propias.error.message)
  if (permisos.error) throw new Error(permisos.error.message)
  const ids = (permisos.data ?? []).map((p) => p.concesion_id as number)
  let extra: typeof propias.data = []
  if (ids.length > 0) {
    const r = await cliente.from('concesiones').select('id, razon_social, nombre_comercial').in('id', ids)
    if (r.error) throw new Error(r.error.message)
    extra = r.data ?? []
  }
  const porId = new Map<number, string>()
  for (const c of [...(propias.data ?? []), ...extra]) {
    porId.set(c.id, c.nombre_comercial ?? c.razon_social)
  }
  return [...porId].map(([id, nombre]) => ({ id, nombre }))
}
