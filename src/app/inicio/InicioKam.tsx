import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { contarTareas, hayAgotadas, type FilaInicio, type Tarea } from '../../dominio/tareas'
import { usePerfil } from '../auth/useSesion'
import Contadores from './Contadores'
import { cargarFilasInicio, cargarMisConcesiones } from './datos'
import EtiquetaEstado from './EtiquetaEstado'
import ListaTareas from './ListaTareas'
import PromocionesNuevas from './PromocionesNuevas'

interface Datos {
  filas: FilaInicio[]
  concesiones: { id: number; nombre: string }[]
  ahora: Date
}

export default function InicioKam() {
  const perfil = usePerfil()
  const perfilId = perfil?.id
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activa, setActiva] = useState<Tarea | null>(null)

  const cargar = useCallback(() => {
    if (!perfilId) return
    setError(null)
    Promise.all([cargarFilasInicio(), cargarMisConcesiones(perfilId)])
      .then(([filas, concesiones]) =>
        setDatos({ filas: filas.filter((f) => f.editable === true), concesiones, ahora: new Date() }),
      )
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [perfilId])

  useEffect(cargar, [cargar])

  const cambiar = useCallback((nueva: FilaInicio) => {
    setDatos((d) =>
      d && {
        ...d,
        filas: d.filas.map((f) => (f.seguimiento_id === nueva.seguimiento_id ? nueva : f)),
      },
    )
  }, [])

  const concesiones = useMemo(() => {
    if (!datos) return []
    const porId = new Map<number, { id: number; nombre: string; filas: FilaInicio[] }>()
    for (const c of datos.concesiones) porId.set(c.id, { ...c, filas: [] })
    for (const f of datos.filas) {
      const c = porId.get(f.concesion_id) ?? { id: f.concesion_id, nombre: f.concesion_nombre ?? '', filas: [] as FilaInicio[] }
      c.filas.push(f)
      porId.set(f.concesion_id, c)
    }
    const lista = [...porId.values()]
    for (const c of lista) c.filas.sort((a, b) => a.tag.localeCompare(b.tag, 'es'))
    return lista.sort(
      (a, b) =>
        Number(a.filas.length === 0) - Number(b.filas.length === 0) ||
        a.nombre.localeCompare(b.nombre, 'es'),
    )
  }, [datos])

  if (error) {
    return (
      <div className="aviso" role="alert">
        <p>{error}</p>
        <button className="boton" onClick={cargar}>Reintentar</button>
      </div>
    )
  }
  if (!datos) return <p className="aviso">Cargando…</p>

  const { filas, ahora } = datos
  return (
    <>
      <Contadores
        conteos={contarTareas(filas, ahora)}
        agotadas={hayAgotadas(filas)}
        activa={activa}
        onElegir={(t) => setActiva((a) => (a === t ? null : t))}
      />
      {activa && <ListaTareas tarea={activa} filas={filas} ahora={ahora} onCambio={cambiar} />}
      <PromocionesNuevas filas={filas} ahora={ahora} />
      <section>
        <h2>Mis concesiones ({concesiones.length})</h2>
        {concesiones.length === 0 ? (
          <p>Todavía no tienes concesiones asignadas</p>
        ) : (
          <ul>
            {concesiones.map((c) => (
              <li key={c.id}>
                <Link to={`/concesion/${c.id}`}>{c.nombre}</Link>{' '}
                {c.filas.map((f) => (
                  <EtiquetaEstado key={f.seguimiento_id} fila={f} ahora={ahora} onCambio={cambiar} />
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
