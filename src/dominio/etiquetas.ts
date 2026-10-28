import type { Database } from '../lib/database.types'

type Enums = Database['public']['Enums']
export type EstadoSeguimiento = Enums['estado_seguimiento']
export type EstadoEnvio = Enums['estado_envio']
export type EstadoPromocion = Enums['estado_promocion']
export type Espacio = Enums['espacio']

export const ETIQUETA_ESTADO: Record<EstadoSeguimiento, string> = {
  no_entra: 'No entra',
  pendiente: 'Pendiente',
  acepta: 'Acepta',
  rechaza: 'Rechaza',
  activa: 'Activa',
}

export const ETIQUETA_ENVIO: Record<EstadoEnvio, string> = {
  enviado: 'Enviado',
  pending: 'Pending',
  no_hay: 'No hay',
}

export const ETIQUETA_ESTADO_PROMOCION: Record<EstadoPromocion, string> = {
  borrador: 'Borrador',
  publicada: 'Publicada',
  cerrada: 'Cerrada',
  archivada: 'Archivada',
}

export const ETIQUETA_ESPACIO: Record<Espacio, string> = {
  TMICC: 'TMICC',
  UFS: 'UFS',
  CAMPANAS: 'Campañas',
}
