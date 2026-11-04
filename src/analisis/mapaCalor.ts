/**
 * Posición de cada valor dentro de su columna, de 0 (el menor) a 1 (el mayor).
 * Es por orden y no proporcional: con un valor muy extremo, una escala proporcional dejaría el resto igual.
 * Los valores repetidos comparten posición. Sin dato o con toda la columna igual: null (no hay nada que comparar).
 */
export function posicionesEnColumna(valores: (number | null | undefined)[]): (number | null)[] {
  const distintos = [...new Set(valores.filter((v): v is number => v != null))].sort((a, b) => a - b)
  if (distintos.length < 2) return valores.map(() => null)
  const posicion = new Map(distintos.map((v, i) => [v, i / (distintos.length - 1)]))
  return valores.map((v) => (v == null ? null : posicion.get(v)!))
}
