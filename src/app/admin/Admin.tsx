import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { CabeceraOrdenable } from '../comun/CabeceraOrdenable'
import { useOrden, type Columna } from '../comun/orden'
import { rutaPromocion } from '../inicio/datos'
import { ETIQUETA_ESPACIO, ETIQUETA_ESTADO_PROMOCION, type Espacio, type EstadoPromocion } from '../../dominio/etiquetas'
import Concesiones from './Concesiones'
import Convocatoria from './Convocatoria'
import FormPromocion from './FormPromocion'
import Permisos from './Permisos'
import Usuarios from './Usuarios'

interface Promo {
  id: string; tag: string; espacio: Espacio; estado: EstadoPromocion
  mecanica: string | null; fecha_inicio: string | null; fecha_fin: string | null
}
const fmtFecha = (f: string | null) => (f ? f.split('-').reverse().join('/') : '—')

function ListaAdminPromociones() {
  const [lista, setLista] = useState<Promo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    Promise.resolve(supabase.from('promociones').select('id, tag, espacio, estado, mecanica, fecha_inicio, fecha_fin').order('tag'))
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

  const columnas: Columna<Promo>[] = [
    { clave: 'tag', valor: (p) => p.tag },
    { clave: 'espacio', valor: (p) => ETIQUETA_ESPACIO[p.espacio] },
    { clave: 'mecanica', valor: (p) => p.mecanica },
    { clave: 'vigencia', valor: (p) => p.fecha_inicio },
    { clave: 'estado', valor: (p) => ETIQUETA_ESTADO_PROMOCION[p.estado] },
  ]
  const { filas, orden, alternar } = useOrden(lista, columnas)
  const cab = { orden, onAlternar: alternar }

  return (
    <section>
      <h2>Promociones</h2>
      <p><Link className="boton" to="/admin/promociones/nueva">Nueva promoción</Link></p>
      {error && <p role="alert" className="error">{error}</p>}
      {cargando ? <p className="nota">Cargando…</p> : lista.length === 0 ? <p className="nota">No hay promociones.</p> : (
        <table className="tabla">
          <thead>
            <tr>
              <CabeceraOrdenable clave="tag" {...cab}>TAG</CabeceraOrdenable>
              <CabeceraOrdenable clave="espacio" {...cab}>Espacio</CabeceraOrdenable>
              <CabeceraOrdenable clave="mecanica" {...cab}>Mecánica</CabeceraOrdenable>
              <CabeceraOrdenable clave="vigencia" {...cab}>Vigencia</CabeceraOrdenable>
              <CabeceraOrdenable clave="estado" {...cab}>Estado</CabeceraOrdenable>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p) => (
              <tr key={p.id}>
                <td><Link to={rutaPromocion(p.espacio, p.tag)}>{p.tag}</Link></td>
                <td>{ETIQUETA_ESPACIO[p.espacio]}</td>
                <td>{p.mecanica ?? '—'}</td>
                <td>{fmtFecha(p.fecha_inicio)} – {fmtFecha(p.fecha_fin)}</td>
                <td><span className={`etiqueta-estado estado-promo-${p.estado}`}>{ETIQUETA_ESTADO_PROMOCION[p.estado]}</span></td>
                <td className="acciones">
                  <Link className="boton secundario pequeno" to={`/admin/promociones/${p.id}`}>Editar</Link>
                  <Link className="boton secundario pequeno" to={`/admin/promociones/${p.id}/convocatoria`}>Convocatoria</Link>
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
      <h1>Administración</h1>
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
