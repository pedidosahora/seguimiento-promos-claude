import { useCallback, useEffect, useState } from 'react'
import { contarTareas, hayAgotadas, type FilaInicio, type Tarea } from '../../dominio/tareas'
import Contadores from './Contadores'
import { cargarFilasInicio, cargarKams, cargarRanking, type FilaRanking } from './datos'
import ListaTareas from './ListaTareas'
import PromocionesNuevas from './PromocionesNuevas'
import RankingPromociones from './RankingPromociones'
import TareasPorKam from './TareasPorKam'

interface Datos {
  filas: FilaInicio[]
  kams: { id: string; nombre: string }[]
  ranking: FilaRanking[]
  ahora: Date
}

/** Selección activa: tarea global (kamId undefined) o celda de un KAM (null = «Sin KAM»). */
type Seleccion = { tarea: Tarea; kamId?: string | null }

export default function InicioAdmin() {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null)

  const cargar = useCallback(() => {
    setError(null)
    Promise.all([cargarFilasInicio(), cargarKams(), cargarRanking()])
      .then(([filas, kams, ranking]) => setDatos({ filas, kams, ranking, ahora: new Date() }))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(cargar, [cargar])

  const cambiar = useCallback((nueva: FilaInicio) => {
    setDatos((d) =>
      d && {
        ...d,
        filas: d.filas.map((f) => (f.seguimiento_id === nueva.seguimiento_id ? nueva : f)),
      },
    )
  }, [])

  if (error) {
    return (
      <div className="aviso" role="alert">
        <p>{error}</p>
        <button className="boton" onClick={cargar}>Reintentar</button>
      </div>
    )
  }
  if (!datos) return <p className="aviso">Cargando…</p>

  const { filas, kams, ranking, ahora } = datos
  const porKam = seleccion !== null && seleccion.kamId !== undefined
  const filasLista =
    seleccion && porKam ? filas.filter((f) => (f.kam_id ?? null) === seleccion.kamId) : filas
  return (
    <>
      <Contadores
        conteos={contarTareas(filas, ahora)}
        agotadas={hayAgotadas(filas)}
        activa={seleccion && !porKam ? seleccion.tarea : null}
        onElegir={(t) =>
          setSeleccion((s) => (s && s.kamId === undefined && s.tarea === t ? null : { tarea: t }))
        }
      />
      {seleccion && (
        <ListaTareas
          tarea={seleccion.tarea}
          filas={filasLista}
          ahora={ahora}
          onCambio={cambiar}
          mostrarKam
        />
      )}
      <PromocionesNuevas filas={filas} ahora={ahora} />
      <section>
        <h2>Tareas por KAM</h2>
        <TareasPorKam
          filas={filas}
          kams={kams}
          ahora={ahora}
          onElegir={(kamId, tarea) => setSeleccion({ kamId, tarea })}
        />
      </section>
      <section>
        <h2>Ranking de promociones</h2>
        <RankingPromociones filas={ranking} />
      </section>
    </>
  )
}
