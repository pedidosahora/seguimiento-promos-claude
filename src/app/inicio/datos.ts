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

/** KAM para el reparto de tareas: perfiles activos con rol kam más cualquier perfil titular de una concesión. */
export async function cargarKams(
  cliente: SupabaseClient = supabase,
): Promise<{ id: string; nombre: string }[]> {
  const [activos, titulares] = await Promise.all([
    cliente.from('perfiles').select('id, nombre').eq('rol', 'kam').eq('activo', true),
    cliente.from('concesiones').select('kam_id').not('kam_id', 'is', null),
  ])
  if (activos.error) throw new Error(activos.error.message)
  if (titulares.error) throw new Error(titulares.error.message)
  const porId = new Map<string, string>()
  for (const p of activos.data ?? []) porId.set(p.id, p.nombre)
  const faltan = [...new Set((titulares.data ?? []).map((c) => c.kam_id as string))].filter(
    (id) => !porId.has(id),
  )
  if (faltan.length > 0) {
    const r = await cliente.from('perfiles').select('id, nombre').in('id', faltan)
    if (r.error) throw new Error(r.error.message)
    for (const p of r.data ?? []) porId.set(p.id, p.nombre)
  }
  return [...porId].map(([id, nombre]) => ({ id, nombre }))
}

export type FilaRanking = {
  promocion_id: string
  tag: string
  espacio: Espacio
  usos: number
  cupos: number
  gsv: number
  activas: number
  pct: number | null
}

/** Promociones publicadas con su resumen de cupos; pct = usos / cupos (null si no hay cupos). */
export async function cargarRanking(cliente: SupabaseClient = supabase): Promise<FilaRanking[]> {
  const [promos, resumen] = await Promise.all([
    cliente.from('promociones').select('id, tag, espacio').eq('estado', 'publicada'),
    cliente.from('v_resumen_promocion').select('promocion_id, usos, cupos, gsv, activas'),
  ])
  if (promos.error) throw new Error(promos.error.message)
  if (resumen.error) throw new Error(resumen.error.message)
  const porPromo = new Map((resumen.data ?? []).map((r) => [r.promocion_id as string, r]))
  return (promos.data ?? []).map((p) => {
    const r = porPromo.get(p.id)
    const usos = Number(r?.usos ?? 0)
    const cupos = Number(r?.cupos ?? 0)
    return {
      promocion_id: p.id,
      tag: p.tag,
      espacio: p.espacio as Espacio,
      usos,
      cupos,
      gsv: Number(r?.gsv ?? 0),
      activas: Number(r?.activas ?? 0),
      pct: cupos > 0 ? usos / cupos : null,
    }
  })
}
