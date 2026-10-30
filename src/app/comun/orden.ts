import { useMemo, useState } from 'react';

export type Valor = string | number | Date | null | undefined;
export type Columna<T> = { clave: string; valor: (fila: T) => Valor };
export type Orden = { clave: string; dir: 'asc' | 'desc' } | null;

const vacio = (v: Valor): v is null | undefined | '' => v === null || v === undefined || v === '';

// Fechas ISO (yyyy-mm-dd...) se comparan por tiempo; el resto de texto, por localeCompare.
const ES_ISO = /^\d{4}-\d{2}-\d{2}([T ].*)?$/;

function comparar(a: Exclude<Valor, null | undefined | ''>, b: Exclude<Valor, null | undefined | ''>): number {
  if (a instanceof Date || b instanceof Date) {
    return new Date(a).getTime() - new Date(b).getTime();
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') {
    if (ES_ISO.test(a) && ES_ISO.test(b)) {
      const d = Date.parse(a) - Date.parse(b);
      if (!Number.isNaN(d)) return d;
    }
    return a.localeCompare(b, 'es', { sensitivity: 'base' });
  }
  return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' });
}

export function ordenar<T>(filas: T[], columnas: Columna<T>[], orden: Orden): T[] {
  if (orden === null) return filas;
  const col = columnas.find((c) => c.clave === orden.clave);
  if (!col) return filas;
  const signo = orden.dir === 'asc' ? 1 : -1;
  return filas
    .map((fila, i) => ({ fila, i, v: col.valor(fila) }))
    .sort((x, y) => {
      const vx = vacio(x.v);
      const vy = vacio(y.v);
      if (vx || vy) return vx && vy ? x.i - y.i : vx ? 1 : -1;
      return signo * comparar(x.v as never, y.v as never) || x.i - y.i;
    })
    .map((e) => e.fila);
}

export function useOrden<T>(filas: T[], columnas: Columna<T>[]) {
  const [orden, setOrden] = useState<Orden>(null);
  const alternar = (clave: string) =>
    setOrden((o) => {
      if (!o || o.clave !== clave) return { clave, dir: 'asc' };
      return o.dir === 'asc' ? { clave, dir: 'desc' } : null;
    });
  // columnas suele definirse inline; ordenar es barato, no se memoiza por columnas.
  const ordenadas = useMemo(() => ordenar(filas, columnas, orden), [filas, orden]); // eslint-disable-line react-hooks/exhaustive-deps
  return { filas: ordenadas, orden, alternar };
}
