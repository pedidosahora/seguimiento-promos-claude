import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { FilaAnalisis } from '../../analisis/agregar'

const PAGINA = 1000

const SELECT =
  'id, estado, cupos, usos, gsv, ' +
  'promociones!inner(id, tag, espacio, marca, canal, estado, fecha_inicio), ' +
  'concesiones!inner(id, razon_social, nombre_comercial, kam_id, territorios(nombre), kam:perfiles!concesiones_kam_id_fkey(nombre))'

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

/** PostgREST puede devolver objeto o lista de un elemento en relaciones embebidas. */
function uno<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

/** Todas las filas de seguimiento de promociones no borrador, leídas en bloques de 1000. */
export async function cargarFilasAnalisis(cliente: SupabaseClient = supabase): Promise<FilaAnalisis[]> {
  const filas: FilaAnalisis[] = []
  for (let i = 0; ; i += PAGINA) {
    const { data, error } = await cliente
      .from('seguimiento')
      .select(SELECT)
      .neq('promociones.estado', 'borrador')
      .order('id')
      .range(i, i + PAGINA - 1)
    if (error) throw new Error(error.message)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pagina = (data ?? []) as any[]
    for (const r of pagina) {
      const p = uno(r.promociones)
      const c = uno(r.concesiones)
      if (!p || !c) continue
      filas.push({
        seguimiento_id: r.id,
        estado: r.estado,
        cupos: num(r.cupos),
        usos: num(r.usos),
        gsv: num(r.gsv),
        promocion_id: p.id,
        tag: p.tag,
        espacio: p.espacio,
        marca: p.marca,
        canal: p.canal ?? null,
        estado_promocion: p.estado,
        fecha_inicio: p.fecha_inicio ?? null,
        concesion_id: c.id,
        concesion_nombre: c.nombre_comercial ?? c.razon_social,
        territorio: uno(c.territorios)?.nombre ?? null,
        kam_id: c.kam_id ?? null,
        kam_nombre: uno(c.kam)?.nombre ?? null,
      })
    }
    if (pagina.length < PAGINA) break
  }
  return filas
}
