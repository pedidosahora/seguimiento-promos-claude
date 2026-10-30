import { usePerfil } from '../auth/useSesion'
import InicioAdmin from './InicioAdmin'
import InicioKam from './InicioKam'

export default function Inicio() {
  const perfil = usePerfil()
  if (perfil?.rol === 'admin') return <InicioAdmin />
  return <InicioKam />
}
