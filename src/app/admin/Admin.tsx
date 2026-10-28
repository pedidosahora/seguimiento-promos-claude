import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ETIQUETA_ESPACIO, ETIQUETA_ESTADO_PROMOCION, type Espacio, type EstadoPromocion } from '../../dominio/etiquetas'
import Concesiones from './Concesiones'
import Convocatoria from './Convocatoria'
import FormPromocion from './FormPromocion'
import Permisos from './Permisos'
import Usuarios from './Usuarios'

interface Promo { id: string; tag: string; espacio: Espacio; estado: EstadoPromocion }

function ListaAdminPromociones() {
  const [lista, setLista] = useState<Promo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    Promise.resolve(supabase.from('promociones').select('id, tag, espacio, estado').order('tag'))
      .then(({ data, error: e }) => {
        if (!vivo) return
        if (e) setError(e.message)
        setLista((data ?? []) as Promo[])
      })
      .catch((e) => vivo && setError(e instanceof Error ? e.message : 'No se han podido cargar las promociones'))
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [])

  return (
    <section>
      <h2>Promociones</h2>
      <p><Link className="boton" to="/admin/promociones/nueva">Nueva promoción</Link></p>
      {error && <p role="alert" className="error">{error}</p>}
      {cargando ? <p className="nota">Cargando…</p> : lista.length === 0 ? <p className="nota">No hay promociones.</p> : (
        <table className="tabla">
          <thead><tr><th>TAG</th><th>Espacio</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td>{p.tag}</td><td>{ETIQUETA_ESPACIO[p.espacio]}</td><td>{ETIQUETA_ESTADO_PROMOCION[p.estado]}</td>
                <td className="acciones">
                  <Link to={`/admin/promociones/${p.id}`}>Editar</Link>
                  <Link to={`/admin/promociones/${p.id}/convocatoria`}>Convocatoria</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default function Admin() {
  return (
    <div>
      <nav className="subnav">
        <NavLink to="/admin/promociones">Promociones</NavLink>
        <NavLink to="/admin/concesiones">Concesiones</NavLink>
        <NavLink to="/admin/usuarios">Usuarios</NavLink>
        <NavLink to="/admin/permisos">Permisos</NavLink>
      </nav>
      <Routes>
        <Route index element={<Navigate to="promociones" replace />} />
        <Route path="promociones" element={<ListaAdminPromociones />} />
        <Route path="promociones/nueva" element={<FormPromocion />} />
        <Route path="promociones/:id" element={<FormPromocion />} />
        <Route path="promociones/:id/convocatoria" element={<Convocatoria />} />
        <Route path="concesiones" element={<Concesiones />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="permisos" element={<Permisos />} />
      </Routes>
    </div>
  )
}
