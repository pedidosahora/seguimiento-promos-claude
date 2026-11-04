import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { agrupar, filtrar, metricas, rellenarMeses, type Dimension, type FilaAnalisis, type Filtros, type Metricas } from '../../analisis/agregar'
import { fmtEntero, fmtImporte, fmtPct } from '../../dominio/formato'
import { exportarComparativa, nombreArchivoAnalisis } from '../../exportar/analisis'
import { descargar } from '../../exportar/seguimiento'
import { usePerfil } from '../auth/useSesion'
import { CabeceraOrdenable } from '../comun/CabeceraOrdenable'
import { claseNumero } from '../comun/claseNumero'
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

const GRUPOS_COLUMNA = ['Participación', 'Conversión', 'Cupos y usos', 'Resultado'] as const

const COLUMNAS_METRICA: {
  clave: keyof Metricas
  texto: string
  grupo: (typeof GRUPOS_COLUMNA)[number]
  fmt: (v: number | null) => string
}[] = [
  { clave: 'promociones', texto: 'Promociones', grupo: 'Participación', fmt: fmtEntero },
  { clave: 'convocadas', texto: 'Convocadas', grupo: 'Participación', fmt: fmtEntero },
  { clave: 'presentadas', texto: 'Presentadas', grupo: 'Participación', fmt: fmtEntero },
  { clave: 'aceptadas', texto: 'Aceptadas', grupo: 'Participación', fmt: fmtEntero },
  { clave: 'activas', texto: 'Activas', grupo: 'Participación', fmt: fmtEntero },
  { clave: 'pendientes', texto: 'Pendientes', grupo: 'Participación', fmt: fmtEntero },
  { clave: 'rechazadas', texto: 'Rechazadas', grupo: 'Participación', fmt: fmtEntero },
  { clave: 'pctAceptacion', texto: '% aceptación', grupo: 'Conversión', fmt: fmtPct },
  { clave: 'pctActivacion', texto: '% activación', grupo: 'Conversión', fmt: fmtPct },
  { clave: 'cupos', texto: 'Cupos', grupo: 'Cupos y usos', fmt: fmtEntero },
  { clave: 'usos', texto: 'Usos', grupo: 'Cupos y usos', fmt: fmtEntero },
  { clave: 'pctCupos', texto: '% gastados', grupo: 'Cupos y usos', fmt: fmtPct },
  { clave: 'gsv', texto: 'GSV', grupo: 'Resultado', fmt: fmtImporte },
  { clave: 'gsvUso', texto: 'GSV/uso', grupo: 'Resultado', fmt: fmtImporte },
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
  // Agrupando por promoción, «Promociones» siempre vale 1: no aporta.
  const metricasVisibles = dimension === 'promocion' ? COLUMNAS_METRICA.filter((c) => c.clave !== 'promociones') : COLUMNAS_METRICA
  const columnas: Columna<Grupo>[] = [
    // Por mes se ordena por la clave aaaa-mm (cronológico), no por la etiqueta; «sin fecha» queda siempre al final.
    { clave: 'etiqueta', valor: (g) => (dimension === 'mes' ? (g.clave === 'sin-fecha' ? null : g.clave) : g.etiqueta) },
    ...metricasVisibles.map((c) => ({ clave: c.clave, valor: (g: Grupo) => g.m[c.clave] })),
  ]
  const { filas, orden, alternar } = useOrden(grupos, columnas)
  const cab = { orden, onAlternar: alternar }
  visibles.current = filas
  // Cada grupo de columnas empieza con una línea vertical que lo separa del anterior.
  // y los grupos alternos llevan un fondo suave, para seguir la columna con la vista en una tabla tan ancha.
  const claseMetrica = (i: number) => {
    const c = metricasVisibles[i]
    return [
      'num',
      i > 0 && metricasVisibles[i - 1].grupo !== c.grupo && 'inicio-grupo',
      GRUPOS_COLUMNA.indexOf(c.grupo) % 2 === 1 && 'grupo-alterno',
      c.clave === 'gsv' && 'dato-clave',
    ].filter(Boolean).join(' ')
  }
  return (
    <div className="tabla-scroll">
      <table className="tabla tabla-analisis">
        <thead>
          <tr className="fila-grupos">
            <th className="col-fija" />
            {GRUPOS_COLUMNA.map((grupo, i) => (
              <th key={grupo} colSpan={metricasVisibles.filter((c) => c.grupo === grupo).length} scope="colgroup" className={[i > 0 && 'inicio-grupo', i % 2 === 1 && 'grupo-alterno'].filter(Boolean).join(' ') || undefined}>
                {grupo}
              </th>
            ))}
          </tr>
          <tr>
            <CabeceraOrdenable clave="etiqueta" className="col-fija" {...cab}>{etiquetaDim}</CabeceraOrdenable>
            {metricasVisibles.map((c, i) => (
              <CabeceraOrdenable key={c.clave} clave={c.clave} className={claseMetrica(i)} {...cab}>{c.texto}</CabeceraOrdenable>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((g) => (
            <tr key={g.clave}>
              <td className="sin-corte col-fija" title={g.etiqueta}>{g.etiqueta}</td>
              {metricasVisibles.map((c, i) => (
                <td key={c.clave} className={claseNumero(g.m[c.clave], claseMetrica(i))}>{c.fmt(g.m[c.clave])}</td>
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
  // «KAM» es una sigla: va en mayúsculas también dentro de la frase.
  const tituloGrafico = `${ind.texto} por ${dimension === 'kam' ? etiquetaDim : etiquetaDim.toLowerCase()}`

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

      <div className="analisis-bloque">
        <div className="titulo-seccion">
          <h2>Comparativa</h2>
          <div className="analisis-controles">
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
            {grupos.length > 0 && (
              <button className="boton secundario" onClick={exportar}>Exportar a Excel</button>
            )}
          </div>
        </div>
        {grupos.length === 0 ? (
          <p className="grafico-vacio">{SIN_DATOS}</p>
        ) : (
          <>
            <h3>{tituloGrafico}</h3>
            <BarrasHorizontales
              datos={grupos.map((g) => ({ clave: g.clave, etiqueta: g.etiqueta, valor: g.m[indicador] }))}
              formato={ind.formato}
              titulo={tituloGrafico}
            />
            <h3>Detalle</h3>
            <TablaComparativa
              key={`${dimension}-${indicador}`}
              grupos={grupos}
              etiquetaDim={etiquetaDim}
              dimension={dimension}
              visibles={filasTabla}
            />
          </>
        )}
      </div>

      <div className="analisis-bloque">
        <h2>Evolución mensual</h2>
        <div className="evolucion">
          <div>
            <h3>GSV</h3>
            <BarrasMensuales
              datos={meses.map((g) => ({ mes: g.clave, etiqueta: g.etiqueta, valor: g.m.gsv }))}
              formato={fmtImporte}
              titulo="GSV por mes de inicio"
            />
          </div>
          <div>
            <h3>Usos</h3>
            <BarrasMensuales
              datos={meses.map((g) => ({ mes: g.clave, etiqueta: g.etiqueta, valor: g.m.usos }))}
              formato={fmtEntero}
              titulo="Usos por mes de inicio"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
