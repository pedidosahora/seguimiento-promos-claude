import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

export type FilaSeguimiento = Database['public']['Tables']['seguimiento']['Row']

/** Fila de la tabla: seguimiento + datos de la concesión aplanados. */
export interface FilaGrid extends FilaSeguimiento {
  nombre: string
  kam_id: string | null
  kam_nombre: string | null
  territorio: string | null
}

export class ConflictoError extends Error {
  constructor(mensaje = 'Esta fila ha cambiado; recarga') {
    super(mensaje)
    this.name = 'ConflictoError'
  }
}

/** Campos del seguimiento que la pantalla puede cambiar. */
export type Cambios = Partial<
  Pick<
    FilaSeguimiento,
    'estado' | 'sms' | 'email' | 'cupos' | 'usos' | 'gsv' | 'fecha_aceptacion' | 'fecha_activacion'
  >
>

/**
 * UPDATE con control de concurrencia: solo escribe si la fila sigue en la versión leída.
 * Devuelve la fila guardada (con su nuevo actualizado_en).
 */
export async function guardarFila(
  id: string,
  cambios: Partial<FilaSeguimiento>,
  actualizadoEn: string,
  cliente: SupabaseClient = supabase,
): Promise<FilaSeguimiento> {
  const { data, error } = await cliente
    .from('seguimiento')
    .update(cambios)
    .eq('id', id)
    .eq('actualizado_en', actualizadoEn)
    .select()
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new ConflictoError('Esta fila ha cambiado; recarga')
  return data[0] as FilaSeguimiento
}

export interface ResultadoBloque {
  ok: number
  fallidas: { id: string; motivo: string }[]
  /** Filas guardadas, para refrescar la tabla sin recargar. */
  filas: FilaSeguimiento[]
}

/** Aplica el mismo cambio a varias filas; cada una se guarda por separado y los fallos no frenan al resto. */
export async function guardarEnBloque(
  ids: string[],
  cambios: Partial<Pick<FilaSeguimiento, 'estado' | 'sms' | 'email'>>,
  cliente: SupabaseClient = supabase,
): Promise<ResultadoBloque> {
  const resultado: ResultadoBloque = { ok: 0, fallidas: [], filas: [] }
  const respuestas = await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await cliente.from('seguimiento').update(cambios).eq('id', id).select()
      return { id, data, error }
    }),
  )
  for (const { id, data, error } of respuestas) {
    if (error) resultado.fallidas.push({ id, motivo: error.message })
    else if (!data || data.length === 0) resultado.fallidas.push({ id, motivo: 'Sin permiso para editar esta fila' })
    else {
      resultado.ok += 1
      resultado.filas.push(data[0] as FilaSeguimiento)
    }
  }
  return resultado
}
