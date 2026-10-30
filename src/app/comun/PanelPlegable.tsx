import type { ReactNode } from 'react';

type Props = { abierto: boolean; titulo: string; children: ReactNode };

/** Panel que solo se muestra abierto; el formulario va dentro. */
export function PanelPlegable({ abierto, titulo, children }: Props) {
  if (!abierto) return null;
  return (
    <section className="panel" aria-label={titulo}>
      <h3>{titulo}</h3>
      {children}
    </section>
  );
}
