import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePerfil } from '../auth/useSesion'
import BarraBloque, { type CambiosBloque } from './BarraBloque'
import Cabecera, { type Indicadores, type Pestana, type PromoCabecera } from './Cabecera'
import { localAIso, validarCambio, type CampoEditable } from './celdas'
import FichaLateral from './FichaLateral'
import {
  ConflictoError,
  guardarEnBloque,
  guardarFila,
  type FilaGrid,
  type FilaSeguimiento,
} from './servicio'
import TablaSeguimiento from './TablaSeguimiento'

interface PromoCompleta extends PromoCabecera {
  id: string
  umbral_cupos: number
}

const COLUMNAS_CONCESION =
  'concesiones(razon_social, nombre_comercial, kam_id, territorios(nombre), kam:perfiles!concesiones_kam_id_fkey(nombre))'

/** Aplana una fila de seguimiento con su concesión embebida. */
function aplanar(r: Record<string, unknown>): FilaGrid {
  const { concesiones: c, ...resto } = r as Record<string, unknown> & {
    concesiones: {
      razon_social: string
      nombre_comercial: string | null
      kam_id: string | null
      territorios: { nombre: string } | null
      kam: { nombre: string } | null
    } | null
  }
  const base = resto as unknown as FilaSeguimiento
  return {
    ...base,
    cupos: base.cupos == null ? null : Number(base.cupos),
    usos: base.usos == null ? null : Number(base.usos),
    gsv: base.gsv == null ? null : Number(base.gsv),
    nombre: c?.nombre_comercial || c?.razon_social || `Concesión ${base.concesion_id}`,
    kam_id: c?.kam_id ?? null,
    kam_nombre: c?.kam?.nombre ?? null,
    territorio: c?.territorios?.nombre ?? null,
  }
}

const numONull = (v: unknown) => (v == null ? null : Number(v))

export default function Promocion() {
  const { tag = '' } = useParams()
  const perfil = usePerfil()
  const esAdmin = perfil?.rol === 'admin'

  const [promo, setPromo] = useState<PromoCompleta | null>(null)
  const [filas, setFilas] = useState<FilaGrid[]>([])
  const [editables, setEditables] = useState<Set<number>>(new Set())
  const [indicadores, setIndicadores] = useState<Indicadores | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pestanaElegida, setPestana] = useState<Pestana | null>(null)
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [limpiar, setLimpiar] = useState(0)
  const [fichaId, setFichaId] = useState<string | null>(null)
  const [bloqueando, setBloqueando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  // Versión (actualizado_en) más reciente de cada fila, para encadenar guardados sin falsos conflictos.
  const versiones = useRef(new Map<string, string>())
  const colas = useRef(new Map<string, Promise<unknown>>())
  const promoId = promo?.id

  const cargarIndicadores = useCallback(async (id: string) => {
    const { data, error: err } = await supabase.from('v_resumen_promocion').select('*').eq('promocion_id', id).maybeSingle()
    if (err) throw new Error(err.message)
    if (!data) return setIndicadores(null)
    const d = data as Record<string, unknown>
    setIndicadores({
      convocadas: Number(d.convocadas ?? 0),
      presentadas: Number(d.presentadas ?? 0),
      pct_aceptacion: numONull(d.pct_aceptacion),
      pct_pendientes: numONull(d.pct_pendientes),
      pct_rechazo: numONull(d.pct_rechazo),
      pct_activacion: numONull(d.pct_activacion),
      usos: Number(d.usos ?? 0),
      gsv: Number(d.gsv ?? 0),
    })
  }, [])

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setError(null)
    ;(async () => {
      const { data: p, error: ep } = await supabase
        .from('promociones')
        .select('id, tag, espacio, mecanica, fecha_inicio, fecha_fin, estado, umbral_cupos')
        .eq('tag', decodeURIComponent(tag).toUpperCase())
        .maybeSingle()
      if (ep) throw new Error(ep.message)
      if (!p) throw new Error('Promoción no encontrada')
      const [s, ed] = await Promise.all([
        supabase.from('seguimiento').select(`*, ${COLUMNAS_CONCESION}`).eq('promocion_id', p.id),
        supabase.rpc('concesiones_editables', { p_promocion: p.id }),
      ])
      if (s.error) throw new Error(s.error.message)
      if (ed.error) throw new Error(ed.error.message)
      const lista = ((s.data ?? []) as Record<string, unknown>[]).map(aplanar)
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      if (!vivo) return
      versiones.current = new Map(lista.map((f) => [f.id, f.actualizado_en]))
      setPromo({ ...(p as PromoCompleta), umbral_cupos: Number(p.umbral_cupos) })
      setFilas(lista)
      setEditables(new Set((ed.data ?? []) as number[]))
      await cargarIndicadores(p.id)
    })()
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : 'No se ha podido cargar la promoción')
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [tag, recarga, cargarIndicadores])

  const aplicarFilas = useCallback((guardadas: FilaSeguimiento[]) => {
    const porId = new Map(guardadas.map((g) => [g.id, g]))
    for (const g of guardadas) versiones.current.set(g.id, g.actualizado_en)
    setFilas((actuales) =>
      actuales.map((f) => {
        const g = porId.get(f.id)
        return g ? { ...f, ...g, gsv: numONull(g.gsv), cupos: numONull(g.cupos), usos: numONull(g.usos) } : f
      }),
    )
  }, [])

  const refrescarIndicadores = useCallback(() => {
    if (promoId) cargarIndicadores(promoId).catch(() => undefined)
  }, [promoId, cargarIndicadores])

  const editar = useCallback(
    (fila: FilaGrid, campo: CampoEditable, valor: unknown) => {
      const v = validarCambio(campo, valor)
      if ('error' in v) {
        setError(v.error)
        return
      }
      const actual = campo.startsWith('fecha') ? localAIso(fila[campo] as string | null) : fila[campo]
      const nuevo = campo.startsWith('fecha') ? (v.valor as string | null) : v.valor
      if (actual === nuevo) return
      setError(null)
      setAviso(null)
      const previa = colas.current.get(fila.id) ?? Promise.resolve()
      const tarea = previa.then(async () => {
        try {
          const guardada = await guardarFila(
            fila.id,
            { [campo]: v.valor } as Partial<FilaSeguimiento>,
            versiones.current.get(fila.id) ?? fila.actualizado_en,
          )
          aplicarFilas([guardada])
          refrescarIndicadores()
        } catch (e) {
          setError(e instanceof Error ? e.message : 'No se ha podido guardar')
          if (e instanceof ConflictoError) setRecarga((n) => n + 1)
        }
      })
      colas.current.set(fila.id, tarea)
    },
    [aplicarFilas, refrescarIndicadores],
  )

  const aplicarBloque = useCallback(
    async (cambios: CambiosBloque) => {
      const propias = seleccion.filter((id) => {
        const f = filas.find((x) => x.id === id)
        return f && editables.has(f.concesion_id)
      })
      const sinPermiso = seleccion.length - propias.length
      setBloqueando(true)
      setError(null)
      setAviso(null)
      try {
        const r = await guardarEnBloque(propias, cambios as Parameters<typeof guardarEnBloque>[1])
        aplicarFilas(r.filas)
        refrescarIndicadores()
        const partes = [`${r.ok} ${r.ok === 1 ? 'fila actualizada' : 'filas actualizadas'}`]
        if (sinPermiso) partes.push(`${sinPermiso} sin permiso de edición (omitidas)`)
        setAviso(partes.join('. ') + '.')
        if (r.fallidas.length) {
          const motivos = [...new Set(r.fallidas.map((x) => x.motivo))].join('; ')
          setError(`${r.fallidas.length} no se han podido guardar: ${motivos}`)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se ha podido aplicar el cambio')
      } finally {
        setBloqueando(false)
      }
    },
    [seleccion, filas, editables, aplicarFilas, refrescarIndicadores],
  )

  const recargarFila = useCallback(
    async (id: string) => {
      const { data, error: err } = await supabase.from('seguimiento').select('*').eq('id', id).maybeSingle()
      if (err) throw new Error(err.message)
      if (data) aplicarFilas([data as FilaSeguimiento])
      refrescarIndicadores()
    },
    [aplicarFilas, refrescarIndicadores],
  )

  const hayMias = filas.some((f) => f.kam_id === perfil?.id)
  const pestana: Pestana = pestanaElegida ?? (hayMias ? 'mis' : 'todas')
  const visibles = useMemo(() => {
    if (pestana === 'mis') return filas.filter((f) => f.kam_id === perfil?.id)
    if (pestana === 'pendientes') return filas.filter((f) => f.estado === 'pendiente')
    return filas
  }, [filas, pestana, perfil?.id])

  const abrirFicha = useCallback((id: string) => setFichaId(id), [])
  const fichaFila = fichaId ? filas.find((f) => f.id === fichaId) : undefined

  if (cargando && !promo) return <p className="nota">Cargando…</p>
  if (!promo) return <p role="alert" className="error">{error ?? 'Promoción no encontrada'}</p>

  return (
    <section>
      <Cabecera
        promo={promo}
        indicadores={indicadores}
        pestana={pestana}
        onPestana={(p) => {
          setPestana(p)
          setLimpiar((n) => n + 1)
        }}
      />
      {error && <p role="alert" className="error">{error}</p>}
      {aviso && <p role="status" className="nota">{aviso}</p>}
      {promo.estado !== 'publicada' && !esAdmin && (
        <p className="nota">Esta promoción no está publicada: solo lectura.</p>
      )}
      <BarraBloque
        key={seleccion.length === 0 ? 'vacia' : 'activa'}
        seleccionadas={seleccion.length}
        ocupado={bloqueando}
        onAplicar={aplicarBloque}
        onLimpiar={() => setLimpiar((n) => n + 1)}
      />
      <div className={fichaFila ? 'promo-cuerpo con-ficha' : 'promo-cuerpo'}>
        {visibles.length === 0 ? (
          <p className="nota">No hay concesiones en esta vista.</p>
        ) : (
          <TablaSeguimiento
            filas={visibles}
            editables={editables}
            esAdmin={esAdmin}
            umbral={promo.umbral_cupos}
            onEditar={editar}
            onSeleccion={setSeleccion}
            onAbrirFicha={abrirFicha}
            limpiarSeleccion={limpiar}
          />
        )}
        {fichaFila && perfil && (
          <FichaLateral
            fila={fichaFila}
            umbral={promo.umbral_cupos}
            editable={editables.has(fichaFila.concesion_id)}
            esAdmin={esAdmin}
            perfilId={perfil.id}
            onCerrar={() => setFichaId(null)}
            onDeshecho={recargarFila}
          />
        )}
      </div>
    </section>
  )
}
