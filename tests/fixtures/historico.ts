/** Hoja sintética con la disposición real del seguimiento: bloques de 15 columnas. */
export type FilaSintetica = {
  id: unknown
  concesion?: string
  kam?: string
  territorio?: string
  estado: string
  aceptacion?: unknown
  activacion?: unknown
  cupos?: unknown
  usos?: unknown
  gsv?: unknown
  sms?: unknown
  email?: unknown
}

export type BloqueSintetico = {
  tag: string | null
  mecanica?: string | null
  objetivo?: string | null
  canal?: string | null
  inicio?: unknown
  fin?: unknown
  filas: FilaSintetica[]
}

const ANCHO = 15
const FILA_CABECERA = 10 // fila 11 (índice 0)

export function construirHojaHistorico(bloques: BloqueSintetico[]): unknown[][] {
  const alto = FILA_CABECERA + 1 + Math.max(0, ...bloques.map((b) => b.filas.length))
  const hoja: unknown[][] = Array.from({ length: alto }, () =>
    new Array(bloques.length * ANCHO).fill(null),
  )
  bloques.forEach((b, i) => {
    const c = i * ANCHO
    // Filas 2–4: resúmenes con fórmulas rotas
    for (let r = 1; r <= 3; r++) for (let k = 0; k < ANCHO; k++) hoja[r][c + k] = '#VALUE!'
    // Filas 6–10: etiquetas en c+4, valores en c+5
    hoja[5][c + 4] = 'FECHAS'
    hoja[5][c + 5] = b.inicio ?? null
    hoja[5][c + 6] = b.fin ?? null
    hoja[6][c + 4] = 'MECÁNICA'
    hoja[6][c + 5] = b.mecanica ?? null
    hoja[7][c + 4] = 'OBJETIVO'
    hoja[7][c + 5] = b.objetivo ?? null
    hoja[8][c + 4] = 'CANAL'
    hoja[8][c + 5] = b.canal ?? null
    hoja[9][c + 4] = 'TAG'
    hoja[9][c + 5] = b.tag
    // Fila 11: cabecera
    const cab = [
      'ID', 'Concesión', 'KAM', 'Territorio', '➤Status', 'Aceptación', 'Activación',
      'Cupos', 'Usos', '% usos', 'GSV', 'GSV/uso', 'SMS', 'Email', null,
    ]
    cab.forEach((v, k) => (hoja[FILA_CABECERA][c + k] = v))
    b.filas.forEach((f, j) => {
      const r = FILA_CABECERA + 1 + j
      hoja[r][c] = f.id
      hoja[r][c + 1] = f.concesion ?? `Concesión ${f.id}`
      hoja[r][c + 2] = f.kam ?? null
      hoja[r][c + 3] = f.territorio ?? null
      hoja[r][c + 4] = f.estado
      hoja[r][c + 5] = f.aceptacion ?? null
      hoja[r][c + 6] = f.activacion ?? null
      hoja[r][c + 7] = f.cupos ?? '-'
      hoja[r][c + 8] = f.usos ?? null
      hoja[r][c + 9] = '#VALUE!' // calculada
      hoja[r][c + 10] = f.gsv ?? null
      hoja[r][c + 11] = '#VALUE!' // calculada
      hoja[r][c + 12] = f.sms ?? null
      hoja[r][c + 13] = f.email ?? null
    })
  })
  return hoja
}
