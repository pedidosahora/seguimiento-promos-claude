import { SIN_DATOS } from './BarrasHorizontales'

type Dato = { mes: string; etiqueta: string; valor: number }

type Props = {
  datos: Dato[]
  formato: (v: number | null) => string
  titulo: string
}

const COL = 44
const ANCHO_BARRA = 22
const ALTO = 140
const BASE = 150
const R = 4

// Barra con las esquinas superiores redondeadas y la base recta sobre la línea base.
function trazo(x: number, h: number): string {
  if (h <= 0) return ''
  const r = Math.min(R, h, ANCHO_BARRA / 2)
  const y = BASE - h
  return `M${x},${BASE} V${y + r} Q${x},${y} ${x + r},${y} H${x + ANCHO_BARRA - r} Q${x + ANCHO_BARRA},${y} ${x + ANCHO_BARRA},${y + r} V${BASE} Z`
}

export default function BarrasMensuales({ datos, formato, titulo }: Props) {
  if (datos.length === 0) return <p className="grafico-vacio">{SIN_DATOS}</p>
  const meses = [...datos].sort((a, b) => a.mes.localeCompare(b.mes))
  const mayor = meses.reduce((a, b) => (b.valor > a.valor ? b : a), meses[0])
  const tope = mayor.valor > 0 ? mayor.valor : 1
  const ancho = meses.length * COL
  return (
    <div className="grafico barras-v">
      <svg
        viewBox={`0 0 ${ancho} ${BASE + 20}`}
        width={ancho}
        height={BASE + 20}
        role="img"
        aria-label={`${titulo}: ${meses.length} meses; mayor ${mayor.etiqueta} ${formato(mayor.valor)}`}
      >
        <line className="eje-linea" x1={0} x2={ancho} y1={BASE} y2={BASE} />
        <line className="eje-rejilla" x1={0} x2={ancho} y1={BASE - ALTO} y2={BASE - ALTO} />
        {meses.map((d, i) => {
          const x0 = i * COL
          const h = (d.valor / tope) * ALTO
          const x = x0 + (COL - ANCHO_BARRA) / 2
          return (
            <g key={d.mes} className="mes-col">
              <title>{`${d.etiqueta}: ${formato(d.valor)}`}</title>
              <rect className="mes-zona" x={x0} y={0} width={COL} height={BASE + 20} fill="transparent" />
              <path className="mes-barra" d={trazo(x, h)} data-altura={h} />
              {d === mayor && (
                <text className="mes-valor" x={x0 + COL / 2} y={BASE - h - 4} textAnchor="middle">
                  {formato(d.valor)}
                </text>
              )}
              <text className="mes-etiqueta" x={x0 + COL / 2} y={BASE + 14} textAnchor="middle">
                {d.etiqueta}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
