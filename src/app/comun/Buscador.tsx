const sinTildes = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** true si alguno de los textos contiene la consulta, sin distinguir mayúsculas ni tildes. */
export function coincide(consulta: string, ...textos: (string | number | null | undefined)[]): boolean {
  const q = sinTildes(consulta.trim());
  if (!q) return true;
  return textos.some((t) => t != null && sinTildes(String(t)).includes(q));
}

type Props = { valor: string; onCambio: (v: string) => void; etiqueta?: string };

export function Buscador({ valor, onCambio, etiqueta = 'Buscar' }: Props) {
  return (
    <label>
      {etiqueta}
      <input type="search" value={valor} onChange={(e) => onCambio(e.target.value)} />
    </label>
  );
}
