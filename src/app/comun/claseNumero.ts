/** Clase de una celda numérica: atenúa ceros y vacíos para que destaquen los datos reales. */
export function claseNumero(valor: number | string | null | undefined, extra = 'num'): string {
  return valor == null || Number(valor) === 0 ? `${extra} dato-vacio` : extra
}
