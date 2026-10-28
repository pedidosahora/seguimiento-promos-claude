import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePerfil } from './auth/useSesion'

const ESPACIOS = [
  { ruta: '/tmicc', texto: 'TMICC' },
  { ruta: '/ufs', texto: 'UFS' },
  { ruta: '/campanas', texto: 'Campañas' },
  { ruta: '/todos', texto: 'Todos' },
]

export default function Layout() {
  const perfil = usePerfil()
  const esAdmin = perfil?.rol === 'admin'
  return (
    <div className="layout">
      <header className="cabecera">
        <strong className="marca">Seguimiento de promociones</strong>
        <nav>
          {ESPACIOS.map((e) => (
            <NavLink key={e.ruta} to={e.ruta}>{e.texto}</NavLink>
          ))}
          {esAdmin && <NavLink to="/importar">Importar</NavLink>}
          {esAdmin && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <span className="usuario">
          {perfil?.nombre}
          <button className="boton secundario" onClick={() => supabase.auth.signOut()}>Salir</button>
        </span>
      </header>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  )
}
