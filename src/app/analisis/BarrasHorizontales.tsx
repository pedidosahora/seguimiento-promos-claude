type Dato = { clave: string; etiqueta: string; valor: number | null }

type Props = {
  datos: Dato[]
  formato: (v: number | null) => string
  titulo: string
  max?: number
}

export const SIN_DATOS = 'No hay datos con estos filtros'
export const SIN_VALORES = 'Sin valores para este indicador'

export default function BarrasHorizontales({ datos, formato, titulo, max = 15 }: Props) {
  const validos = datos.filter((d): d is { clave: string; etiqueta: string; valor: number } => d.valor != null)
  const filas = [...validos].sort((a, b) => b.valor - a.valor).slice(0, max)
  if (filas.length === 0) return <p className="grafico-vacio">{SIN_VALORES}</p>
  const mayor = filas[0]
  const tope = mayor.valor > 0 ? mayor.valor : 1
  return (
    <>
      <div
        className="grafico barras-h"
        role="img"
        aria-label={`${titulo}: ${validos.length} grupos; mayor ${mayor.etiqueta} ${formato(mayor.valor)}`}
      >
        {filas.map((d, i) => (
          <div key={d.clave} className="barra-fila" title={`${d.etiqueta}: ${formato(d.valor)}`}>
            <span className="barra-etiqueta">{d.etiqueta}</span>
            <span className="barra-pista">
              <span className="barra-relleno" style={{ width: `${Math.max(0, (d.valor / tope) * 100)}%` }} />
            </span>
            {i === 0 ? <span className="barra-valor">{formato(d.valor)}</span> : <span />}
          </div>
        ))}
      </div>
      {validos.length > filas.length && (
        <p className="nota">Se muestran los {filas.length} mayores de {validos.length}; el resto, en la tabla.</p>
      )}
    </>
  )
}
