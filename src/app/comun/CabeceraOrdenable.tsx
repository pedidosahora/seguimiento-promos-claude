import type { ReactNode } from 'react';
import type { Orden } from './orden';

type Props = {
  clave: string;
  orden: Orden;
  onAlternar: (clave: string) => void;
  className?: string;
  children: ReactNode;
};

export function CabeceraOrdenable({ clave, orden, onAlternar, className, children }: Props) {
  const activa = orden !== null && orden.clave === clave;
  const ariaSort = activa ? (orden.dir === 'asc' ? 'ascending' : 'descending') : undefined;
  return (
    <th aria-sort={ariaSort} className={className}>
      <button type="button" className="th-orden" onClick={() => onAlternar(clave)}>
        {children}
        {activa ? (orden.dir === 'asc' ? ' ▲' : ' ▼') : null}
      </button>
    </th>
  );
}
