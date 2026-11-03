import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { agrupar, filtrar, metricas, rellenarMeses, type Dimension, type FilaAnalisis, type Filtros, type Metricas } from '../../analisis/agregar'
import { fmtEntero, fmtImporte, fmtPct } from '../../dominio/formato'
import { exportarComparativa, nombreArchivoAnalisis } from '../../exportar/analisis'
import { descargar } from '../../exportar/seguimiento'
import { usePerfil } from '../auth/useSesion'
import { CabeceraOrdenable } from '../comun/CabeceraOrdenable'
import { useOrden, type Columna } from '../comun/orden'
import BarrasHorizontales, { SIN_DATOS } from './BarrasHorizontales'
import BarrasMensuales from './BarrasMensuales'
import { cargarFilasAnalisis } from './datos'
import FiltrosAnalisis from './FiltrosAnalisis'
import Indicadores from './Indicadores'

const DIMENSIONES: [Dimension, string][] = [
  ['promocion', 'Promoción'],
  ['kam', 'KAM'],
  ['territorio', 'Territorio'],
  ['concesion', 'Concesión'],
  ['espacio', 'Espacio'],
  ['marca', 'Marca'],
  ['canal', 'Canal'],
  ['mes', 'Mes de inicio'],
]

type ClaveIndicador = 'gsv' | 'usos' | 'pctCupos' | 'pctAceptacion' | 'pctActivacion' | 'convocadas'
const INDICADORES: { clave: ClaveIndicador; texto: string; formato: (v: number | null) => string }[] = [
  { clave: 'gsv', texto: 'GSV', formato: fmtImporte },
  { clave: 'usos', texto: 'Usos', formato: fmtEntero },
  { clave: 'pctCupos', texto: '% cupos gastados', formato: fmtPct },
  { clave: 'pctAceptacion', texto: '% aceptación', formato: fmtPct },
  { clave: 'pctActivacion', texto: '% activación', formato: fmtPct },
  { clave: 'convocadas', texto: 'Convocadas', formato: fmtEntero },
]

type Grupo = { clave: string; etiqueta: string; m: Metricas }

const COLUMNAS_METRICA: { clave: keyof Metricas; texto: string; fmt: (v: number | null) => string }[] = [
  { clave: 'promociones', texto: 'Promociones', fmt: fmtEntero },
  { clave: 'convocadas', texto: 'Convocadas', fmt: fmtEntero },
  { clave: 'presentadas', texto: 'Presentadas', fmt: fmtEntero },
  { clave: 'aceptadas', texto: 'Aceptadas', fmt: fmtEntero },
  { clave: 'activas', texto: 'Activas', fmt: fmtEntero },
  { clave: 'pendientes', texto: 'Pendientes', fmt: fmtEntero },
  { clave: 'rechazadas', texto: 'Rechazadas', fmt: fmtEntero },
  { clave: 'pctAceptacion', texto: '% aceptación', fmt: fmtPct },
  { clave: 'pctActivacion', texto: '% activación', fmt: fmtPct },
  { clave: 'cupos', texto: 'Cupos', fmt: fmtEntero },
  { clave: 'usos', texto: 'Usos', fmt: fmtEntero },
  { clave: 'pctCupos', texto: '% cupos gastados', fmt: fmtPct },
  { clave: 'gsv', texto: 'GSV', fmt: fmtImporte },
  { clave: 'gsvUso', texto: 'GSV/uso', fmt: fmtImporte },
]

/** Se monta con `key` por dimensión+indicador: al cambiarlos, el orden manual se reinicia. */
function TablaComparativa({
  grupos,
  etiquetaDim,
  dimension,
  visibles,
}: {
  grupos: Grupo[]
  etiquetaDim: string
  dimension: Dimension
  /** Recibe las filas en el orden que ve la usuaria, para exportarlas igual. */
  visibles: MutableRefObject<Grupo[]>
}) {
  const columnas: Columna<Grupo>[] = [
    // Por mes se ordena por la clave aaaa-mm (cronológico), no por la etiqueta; «sin fecha» queda siempre al final.
    { clave: 'etiqueta', valor: (g) => (dimension === 'mes' ? (g.clave === 'sin-fecha' ? null : g.clave) : g.etiqueta) },
    ...COLUMNAS_METRICA.map((c) => ({ clave: c.clave, valor: (g: Grupo) => g.m[c.clave] })),
  ]
  const { filas, orden, alternar } = useOrden(grupos, columnas)
  const cab = { orden, onAlternar: alternar }
  visibles.current = filas
  return (
    <div className="tabla-scroll">
      <table className="tabla tabla-compacta">
        <thead>
          <tr>
            <CabeceraOrdenable clave="etiqueta" {...cab}>{etiquetaDim}</CabeceraOrdenable>
            {COLUMNAS_METRICA.map((c) => (
              <CabeceraOrdenable key={c.clave} clave={c.clave} className="num" {...cab}>{c.texto}</CabeceraOrdenable>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((g) => (
            <tr key={g.clave}>
              <td className="sin-corte">{g.etiqueta}</td>
              {COLUMNAS_METRICA.map((c) => (
                <td key={c.clave} className="num">{c.fmt(g.m[c.clave])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Analisis() {
  const perfil = usePerfil()
  const esKam = perfil?.rol === 'kam'
  const [filas, setFilas] = useState<FilaAnalisis[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const iniciales = (): Filtros => ({
    espacio: null,
    marca: null,
    estados: ['publicada', 'cerrada'],
    desde: null,
    hasta: null,
    kamId: null,
    territorio: null,
    soloKamId: esKam && perfil ? perfil.id : null,
  })
  const [filtros, setFiltros] = useState<Filtros>(iniciales)
  const [dimension, setDimension] = useState<Dimension>('promocion')
  const [indicador, setIndicador] = useState<ClaveIndicador>('gsv')
  const filasTabla = useRef<Grupo[]>([])

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setError(null)
    cargarFilasAnalisis()
      .then((f) => {
        if (vivo) setFilas(f)
      })
      .catch((e) => {
        if (vivo) setError(e instanceof Error ? e.message : 'No se han podido cargar los datos')
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [intento])

  const visibles = useMemo(() => filtrar(filas, filtros), [filas, filtros])
  const total = useMemo(() => metricas(visibles), [visibles])
  const ind = INDICADORES.find((i) => i.clave === indicador)!
  const [, etiquetaDim] = DIMENSIONES.find(([k]) => k === dimension)!

  // Orden por defecto de la tabla: indicador elegido de mayor a menor (sin dato al final).
  const grupos = useMemo(() => {
    return agrupar(visibles, dimension)
      .map((x, i) => ({ x, i }))
      .sort((a, b) => {
        const va = a.x.m[indicador]
        const vb = b.x.m[indicador]
        if (va == null || vb == null) return va == null && vb == null ? a.i - b.i : va == null ? 1 : -1
        return vb - va || a.i - b.i
      })
      .map((e) => e.x)
  }, [visibles, dimension, indicador])

  const meses = useMemo(
    () => rellenarMeses(agrupar(visibles, 'mes')),
    [visibles],
  )

  if (cargando) return <p className="nota">Cargando…</p>
  if (error) {
    return (
      <section>
        <h1>Análisis</h1>
        <p role="alert" className="error">{error}</p>
        <button className="boton" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
      </section>
    )
  }

  const exportar = () => {
    descargar(
      exportarComparativa(filasTabla.current.map((g) => ({ etiqueta: g.etiqueta, m: g.m })), etiquetaDim),
      nombreArchivoAnalisis(dimension),
    )
  }

  return (
    <section className="analisis">
      <h1>Análisis</h1>
      <FiltrosAnalisis
        filtros={filtros}
        onCambio={setFiltros}
        filas={filas}
        puedeSoloMias={esKam}
        miId={perfil?.id ?? null}
        onLimpiar={JSON.stringify(filtros) !== JSON.stringify(iniciales()) ? () => setFiltros(iniciales()) : undefined}
      />
      <Indicadores m={total} />

      <div className="titulo-seccion">
        <h2>Comparativa</h2>
        {grupos.length > 0 && (
          <button className="boton secundario" onClick={exportar}>Exportar a Excel</button>
        )}
      </div>
      <div className="filtros">
        <label>
          Agrupar por
          <select value={dimension} onChange={(e) => setDimension(e.target.value as Dimension)}>
            {DIMENSIONES.map(([k, t]) => (
              <option key={k} value={k}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Indicador del gráfico
          <select value={indicador} onChange={(e) => setIndicador(e.target.value as ClaveIndicador)}>
            {INDICADORES.map((i) => (
              <option key={i.clave} value={i.clave}>{i.texto}</option>
            ))}
          </select>
        </label>
      </div>
      {grupos.length === 0 ? (
        <p className="grafico-vacio">{SIN_DATOS}</p>
      ) : (
        <>
          <BarrasHorizontales
            datos={grupos.map((g) => ({ clave: g.clave, etiqueta: g.etiqueta, valor: g.m[indicador] }))}
            formato={ind.formato}
            titulo={`${ind.texto} por ${etiquetaDim.toLowerCase()}`}
          />
          <TablaComparativa
            key={`${dimension}-${indicador}`}
            grupos={grupos}
            etiquetaDim={etiquetaDim}
            dimension={dimension}
            visibles={filasTabla}
          />
        </>
      )}

      <h2>Evolución mensual</h2>
      <h3>GSV</h3>
      <BarrasMensuales
        datos={meses.map((g) => ({ mes: g.clave, etiqueta: g.etiqueta, valor: g.m.gsv }))}
        formato={fmtImporte}
        titulo="GSV por mes de inicio"
      />
      <h3>Usos</h3>
      <BarrasMensuales
        datos={meses.map((g) => ({ mes: g.clave, etiqueta: g.etiqueta, valor: g.m.usos }))}
        formato={fmtEntero}
        titulo="Usos por mes de inicio"
      />
    </section>
  )
}
