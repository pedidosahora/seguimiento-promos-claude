import { useMemo } from 'react'
import type { FilaAnalisis, Filtros } from '../../analisis/agregar'
import { ETIQUETA_ESPACIO, type Espacio, type EstadoPromocion } from '../../dominio/etiquetas'

type Props = {
  filtros: Filtros
  onCambio: (f: Filtros) => void
  filas: FilaAnalisis[]
  /** Muestra «Solo mis concesiones» (solo perfil KAM). */
  puedeSoloMias: boolean
  miId: string | null
}

const GRUPOS_ESTADO: { valor: string; texto: string; estados: EstadoPromocion[] }[] = [
  { valor: 'publicada,cerrada', texto: 'Publicada + Cerrada', estados: ['publicada', 'cerrada'] },
  { valor: 'publicada', texto: 'Publicada', estados: ['publicada'] },
  { valor: 'cerrada', texto: 'Cerrada', estados: ['cerrada'] },
  { valor: 'archivada', texto: 'Archivada', estados: ['archivada'] },
  { valor: 'todas', texto: 'Todas', estados: ['publicada', 'cerrada', 'archivada'] },
]

export default function FiltrosAnalisis({ filtros, onCambio, filas, puedeSoloMias, miId }: Props) {
  const kams = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of filas) if (f.kam_id) m.set(f.kam_id, f.kam_nombre ?? f.kam_id)
    return [...m].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [filas])
  const territorios = useMemo(
    () => [...new Set(filas.map((f) => f.territorio).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b, 'es')),
    [filas],
  )
  const cambiar = (parcial: Partial<Filtros>) => onCambio({ ...filtros, ...parcial })
  const valorEstados = GRUPOS_ESTADO.find((g) => g.estados.join() === filtros.estados.join())?.valor ?? 'publicada,cerrada'

  return (
    <div className="filtros analisis-filtros">
      <label>
        Espacio
        <select value={filtros.espacio ?? ''} onChange={(e) => cambiar({ espacio: (e.target.value || null) as Espacio | null })}>
          <option value="">Todos</option>
          {(Object.keys(ETIQUETA_ESPACIO) as Espacio[]).map((k) => (
            <option key={k} value={k}>{ETIQUETA_ESPACIO[k]}</option>
          ))}
        </select>
      </label>
      <label>
        Marca
        <select value={filtros.marca ?? ''} onChange={(e) => cambiar({ marca: (e.target.value || null) as Filtros['marca'] })}>
          <option value="">Todas</option>
          <option value="TMICC">TMICC</option>
          <option value="UFS">UFS</option>
        </select>
      </label>
      <label>
        Estado de la promoción
        <select
          value={valorEstados}
          onChange={(e) => cambiar({ estados: GRUPOS_ESTADO.find((g) => g.valor === e.target.value)!.estados })}
        >
          {GRUPOS_ESTADO.map((g) => (
            <option key={g.valor} value={g.valor}>{g.texto}</option>
          ))}
        </select>
      </label>
      <label>
        Inicio desde
        <input type="date" value={filtros.desde ?? ''} onChange={(e) => cambiar({ desde: e.target.value || null })} />
      </label>
      <label>
        Inicio hasta
        <input type="date" value={filtros.hasta ?? ''} onChange={(e) => cambiar({ hasta: e.target.value || null })} />
      </label>
      <label>
        KAM
        <select
          value={filtros.kamId ?? ''}
          disabled={filtros.soloKamId !== null}
          title={filtros.soloKamId !== null ? 'Desmarca «Solo mis concesiones» para elegir otro KAM' : undefined}
          onChange={(e) => cambiar({ kamId: e.target.value || null })}
        >
          <option value="">Todos</option>
          {kams.map(([id, nombre]) => (
            <option key={id} value={id}>{nombre}</option>
          ))}
        </select>
      </label>
      <label>
        Territorio
        <select value={filtros.territorio ?? ''} onChange={(e) => cambiar({ territorio: e.target.value || null })}>
          <option value="">Todos</option>
          {territorios.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      {puedeSoloMias && (
        <label className="filtro-casilla">
          <input
            type="checkbox"
            checked={filtros.soloKamId !== null}
            onChange={(e) => cambiar({ soloKamId: e.target.checked ? miId : null })}
          />
          Solo mis concesiones
        </label>
      )}
      {filtros.desde && filtros.hasta && filtros.desde > filtros.hasta && (
        <p role="alert" className="error">La fecha "desde" es posterior a "hasta"</p>
      )}
    </div>
  )
}
