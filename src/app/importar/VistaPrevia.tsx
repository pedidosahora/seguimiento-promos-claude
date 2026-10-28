import { useMemo, useState } from 'react'
import { ETIQUETA_ESPACIO, type Espacio } from '../../dominio/etiquetas'

export type Incidencia = { fila: number | null; categoria: string; detalle: string }

export type Conteo = { clave: string; etiqueta: string; n: number }

export type PromoPrevia = {
  tag: string
  accion: 'crear' | 'ya_existe'
  filas: number
  concesiones_nuevas: number[]
  aviso?: string | null
  /** Espacio de la promoción existente (solo en ya_existe). */
  espacio?: Espacio
}

interface Props {
  conteos: Conteo[]
  incidencias: Incidencia[]
  /** Etiqueta legible de cada categoría de incidencia. */
  etiquetas: Record<string, string>
  promociones?: PromoPrevia[]
  /** Espacio elegido para la importación: una promoción existente de otro espacio no se actualiza. */
  espacioActual?: Espacio
  actualizar?: Set<string>
  onActualizar?: (tag: string, marcado: boolean) => void
  antiguos?: { n: number; incluir: boolean; onCambio: (v: boolean) => void }
}

const MAX_FILAS = 500

export default function VistaPrevia({
  conteos, incidencias, etiquetas, promociones, espacioActual, actualizar, onActualizar, antiguos,
}: Props) {
  const [filtro, setFiltro] = useState('')
  const categorias = useMemo(() => [...new Set(incidencias.map((i) => i.categoria))], [incidencias])
  const visibles = filtro ? incidencias.filter((i) => i.categoria === filtro) : incidencias
  const nombre = (c: string) => etiquetas[c] ?? c

  return (
    <div>
      <dl className="indicadores">
        {conteos.map((c) => (
          <div key={c.clave}>
            <dt>{c.etiqueta}</dt>
            <dd>{c.n.toLocaleString('es-ES')}</dd>
          </div>
        ))}
      </dl>

      {antiguos && antiguos.n > 0 && (
        <label className="casilla formulario">
          <input type="checkbox" checked={antiguos.incluir} onChange={(e) => antiguos.onCambio(e.target.checked)} />
          Aplicar también datos más antiguos ({antiguos.n})
        </label>
      )}

      {promociones && promociones.length > 0 && (
        <table className="tabla">
          <thead>
            <tr>
              <th>TAG</th>
              <th>Acción</th>
              <th className="num">Filas</th>
              <th className="num">Concesiones nuevas</th>
              <th>Actualizar</th>
            </tr>
          </thead>
          <tbody>
            {promociones.map((p) => (
              <tr key={p.tag}>
                <td>{p.tag}</td>
                <td>
                  {p.accion === 'crear'
                    ? 'Se creará'
                    : p.espacio ? `Ya existe (en ${ETIQUETA_ESPACIO[p.espacio]})` : 'Ya existe'}
                </td>
                <td className="num">{p.filas}</td>
                <td className="num">{p.concesiones_nuevas.length}</td>
                <td>
                  {p.accion === 'ya_existe' && p.espacio && espacioActual && p.espacio !== espacioActual && (
                    <span className="nota">
                      Está en {ETIQUETA_ESPACIO[p.espacio]}: no se actualizará desde {ETIQUETA_ESPACIO[espacioActual]}
                    </span>
                  )}
                  {p.accion === 'ya_existe' && (!p.espacio || !espacioActual || p.espacio === espacioActual) && (
                    <label className="casilla formulario">
                      <input
                        type="checkbox"
                        aria-label={`Actualizar ${p.tag}`}
                        checked={actualizar?.has(p.tag) ?? false}
                        onChange={(e) => onActualizar?.(p.tag, e.target.checked)}
                      />
                      Actualizar
                    </label>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Incidencias ({incidencias.length})</h2>
      {incidencias.length === 0 ? (
        <p className="nota">Sin incidencias.</p>
      ) : (
        <>
          <div className="filtros">
            <label>
              Categoría
              <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>{nombre(c)}</option>
                ))}
              </select>
            </label>
          </div>
          <table className="tabla">
            <thead>
              <tr>
                <th className="num">Fila</th>
                <th>Categoría</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {visibles.slice(0, MAX_FILAS).map((i, k) => (
                <tr key={k}>
                  <td className="num">{i.fila ?? '—'}</td>
                  <td>{nombre(i.categoria)}</td>
                  <td>{i.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibles.length > MAX_FILAS && (
            <p className="nota">Se muestran las {MAX_FILAS} primeras de {visibles.length}.</p>
          )}
        </>
      )}
    </div>
  )
}
