/** Proporción de cupos usados (1.02 = 102 %). null si no hay cupos definidos. */
export function pctCupos(usos: number | null, cupos: number | null): number | null {
  if (usos == null || !cupos) return null
  return usos / cupos
}

/** GSV medio por uso. null si no hay usos. */
export function gsvPorUso(gsv: number | null, usos: number | null): number | null {
  if (gsv == null || !usos) return null
  return gsv / usos
}

export function nivelAlertaCupos(
  usos: number | null,
  cupos: number | null,
  umbral: number,
): 'agotado' | 'cerca' | null {
  const pct = pctCupos(usos, cupos)
  if (pct == null) return null
  if (pct >= 1) return 'agotado'
  if (pct >= umbral) return 'cerca'
  return null
}
