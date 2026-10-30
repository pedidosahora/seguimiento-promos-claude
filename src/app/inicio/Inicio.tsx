import { usePerfil } from '../auth/useSesion'
import InicioKam from './InicioKam'

export default function Inicio() {
  const perfil = usePerfil()
  if (perfil?.rol === 'admin') return <p>Inicio de administración</p>
  return <InicioKam />
}
