import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const mocks = vi.hoisted(() => ({
  cargarFilasAnalisis: vi.fn(),
  exportarComparativa: vi.fn(() => new Blob(['x'])),
  descargar: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }))
vi.mock('../../src/app/analisis/datos', () => ({ cargarFilasAnalisis: mocks.cargarFilasAnalisis }))
vi.mock('../../src/exportar/analisis', async (orig) => ({
  ...(await orig<typeof import('../../src/exportar/analisis')>()),
  exportarComparativa: mocks.exportarComparativa,
}))
vi.mock('../../src/exportar/seguimiento', () => ({ descargar: mocks.descargar }))

import Analisis from '../../src/app/analisis/Analisis'
import { SesionContext, type Perfil } from '../../src/app/auth/useSesion'
import type { FilaAnalisis } from '../../src/analisis/agregar'

const kam = { id: 'k1', nombre: 'Ana', rol: 'kam', email: 'a@x.com' } as Perfil
const admin = { id: 'a1', nombre: 'Adm', rol: 'admin', email: 'adm@x.com' } as Perfil

const fila = (p: Partial<FilaAnalisis>): FilaAnalisis => ({
  seguimiento_id: Math.random().toString(),
  estado: 'activa', cupos: 10, usos: 5, gsv: 100, promocion_id: 'p1', tag: 'PROMO-A',
  espacio: 'TMICC', marca: 'TMICC', canal: null, estado_promocion: 'publicada', fecha_inicio: '2026-10-05',
  concesion_id: 1, concesion_nombre: 'Bar Pepe', territorio: 'Norte', kam_id: 'k1', kam_nombre: 'Ana', ...p,
})

const DATOS: FilaAnalisis[] = [
  fila({ gsv: 300, usos: 30, cupos: 60 }),
  fila({ tag: 'PROMO-B', promocion_id: 'p2', espacio: 'UFS', marca: 'UFS', gsv: 900, usos: 10, cupos: 20, concesion_id: 2, concesion_nombre: 'Bar Luis', kam_id: 'k2', kam_nombre: 'Berta', territorio: 'Sur' }),
]

function montar(perfil: Perfil) {
  return render(
    <MemoryRouter>
      <SesionContext.Provider value={{ cargando: false, perfil, haySesion: true }}>
        <Analisis />
      </SesionContext.Provider>
    </MemoryRouter>,
  )
}
const indicador = (t: string) =>
  within(screen.getByText(t, { selector: 'dt' }).parentElement!).getByText(/./, { selector: 'dd' })
const primeraColumna = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(2) // dos filas de cabecera: grupos y columnas
    .map((r) => within(r).getAllByRole('cell')[0].textContent)

describe('Analisis', () => {
  beforeEach(() => {
    mocks.cargarFilasAnalisis.mockResolvedValue(DATOS)
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('muestra Cargando y luego los indicadores', async () => {
    montar(admin)
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    await screen.findByText('Comparativa')
    expect(indicador('Convocadas')).toHaveTextContent('2')
  })

  it('error de carga con Reintentar', async () => {
    mocks.cargarFilasAnalisis.mockRejectedValueOnce(new Error('caído'))
    montar(admin)
    expect(await screen.findByText('caído')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByText('Comparativa')
  })

  it('KAM: «Solo mis concesiones» marcada por defecto y filtra', async () => {
    montar(kam)
    await screen.findByText('Comparativa')
    expect(screen.getByLabelText('Solo mis concesiones')).toBeChecked()
    expect(indicador('Convocadas')).toHaveTextContent('1')
    fireEvent.click(screen.getByLabelText('Solo mis concesiones'))
    expect(indicador('Convocadas')).toHaveTextContent('2')
  })

  it('admin: sin casilla «Solo mis concesiones»', async () => {
    montar(admin)
    await screen.findByText('Comparativa')
    expect(screen.queryByLabelText('Solo mis concesiones')).not.toBeInTheDocument()
  })

  it('cambiar Espacio recalcula los indicadores', async () => {
    montar(admin)
    await screen.findByText('Comparativa')
    fireEvent.change(screen.getByLabelText('Espacio'), { target: { value: 'UFS' } })
    expect(indicador('Convocadas')).toHaveTextContent('1')
    expect(indicador('GSV')).toHaveTextContent('900')
  })

  it('por defecto agrupa por Promoción y ordena por GSV descendente', async () => {
    montar(admin)
    await screen.findByText('Comparativa')
    expect(primeraColumna()).toEqual(['PROMO-B', 'PROMO-A'])
  })

  it('«Agrupar por» KAM cambia las filas', async () => {
    montar(admin)
    await screen.findByText('Comparativa')
    fireEvent.change(screen.getByLabelText('Agrupar por'), { target: { value: 'kam' } })
    expect(primeraColumna().sort()).toEqual(['Ana', 'Berta'])
  })

  it('cambiar el indicador reinicia el orden por defecto', async () => {
    montar(admin)
    await screen.findByText('Comparativa')
    fireEvent.change(screen.getByLabelText('Indicador del gráfico'), { target: { value: 'usos' } })
    expect(primeraColumna()).toEqual(['PROMO-A', 'PROMO-B'])
  })

  it('ordenar una columna por su cabecera', async () => {
    montar(admin)
    await screen.findByText('Comparativa')
    const tabla = within(screen.getByRole('table'))
    fireEvent.click(tabla.getByRole('button', { name: /^Usos/ }))
    expect(primeraColumna()).toEqual(['PROMO-B', 'PROMO-A'])
    fireEvent.click(tabla.getByRole('button', { name: /^Usos/ }))
    expect(primeraColumna()).toEqual(['PROMO-A', 'PROMO-B'])
  })

  it('filtros que vacían: aviso en gráficos y tabla, indicadores a 0/—', async () => {
    montar(admin)
    await screen.findByText('Comparativa')
    fireEvent.change(screen.getByLabelText('Estado de la promoción'), { target: { value: 'archivada' } })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    // Un solo aviso en la comparativa (no el del gráfico y el de la tabla) más los dos gráficos mensuales.
    expect(screen.getAllByText('No hay datos con estos filtros')).toHaveLength(3)
    expect(indicador('Convocadas')).toHaveTextContent('0')
    expect(indicador('% aceptación')).toHaveTextContent('—')
  })

  it('KAM sin concesiones: vacío sin error', async () => {
    mocks.cargarFilasAnalisis.mockResolvedValue([DATOS[1]])
    montar(kam)
    await screen.findByText('Comparativa')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getAllByText('No hay datos con estos filtros')).toHaveLength(3)
  })

  it('filas pero indicador sin valores: aviso en el gráfico y la tabla sigue', async () => {
    mocks.cargarFilasAnalisis.mockResolvedValue([fila({ cupos: 0, usos: 0 })])
    montar(admin)
    await screen.findByText('Comparativa')
    fireEvent.change(screen.getByLabelText('Indicador del gráfico'), { target: { value: 'pctCupos' } })
    expect(screen.getByText('Sin valores para este indicador')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('la tabla incluye Aceptadas y Rechazadas', async () => {
    mocks.cargarFilasAnalisis.mockResolvedValue([fila({ estado: 'acepta' }), fila({ estado: 'rechaza' }), fila({ estado: 'rechaza' })])
    montar(admin)
    await screen.findByText('Comparativa')
    const t = within(screen.getByRole('table'))
    const filas = t.getAllByRole('row')
    const cab = within(filas[1]).getAllByRole('columnheader').map((h) => h.textContent ?? '')
    const celdas = within(filas[2]).getAllByRole('cell').map((c) => c.textContent)
    expect(celdas[cab.findIndex((x) => x.startsWith('Aceptadas'))]).toBe('1')
    expect(celdas[cab.findIndex((x) => x.startsWith('Rechazadas'))]).toBe('2')
  })

  it('agrupa las columnas y cada grupo abarca todas las suyas', async () => {
    mocks.cargarFilasAnalisis.mockResolvedValue([fila({ estado: 'acepta' })])
    montar(admin)
    await screen.findByText('Comparativa')
    const [grupos, columnas] = within(screen.getByRole('table')).getAllByRole('row')
    const celdas = within(grupos).getAllByRole('columnheader')
    expect(celdas.map((c) => c.textContent)).toEqual(['', 'Participación', 'Conversión', 'Cupos y usos', 'Resultado'])
    const abarcadas = celdas.reduce((n, c) => n + Number(c.getAttribute('colspan') ?? 1), 0)
    expect(abarcadas).toBe(within(columnas).getAllByRole('columnheader').length)
  })

  it('«Mes de inicio»: ordena por mes cronológico y «Sin fecha» al final', async () => {
    mocks.cargarFilasAnalisis.mockResolvedValue([
      fila({ fecha_inicio: '2026-10-05', gsv: 10 }),
      fila({ fecha_inicio: '2026-02-05', gsv: 30 }),
      fila({ fecha_inicio: null, gsv: 99 }),
      fila({ fecha_inicio: '2026-04-05', gsv: 20 }),
    ])
    montar(admin)
    await screen.findByText('Comparativa')
    fireEvent.change(screen.getByLabelText('Agrupar por'), { target: { value: 'mes' } })
    const cab = () => within(screen.getByRole('table')).getByRole('button', { name: /^Mes de inicio/ })
    fireEvent.click(cab())
    expect(primeraColumna()).toEqual(['feb 2026', 'abr 2026', 'oct 2026', 'Sin fecha'])
    fireEvent.click(cab())
    expect(primeraColumna()).toEqual(['oct 2026', 'abr 2026', 'feb 2026', 'Sin fecha'])
  })

  it('Evolución mensual incluye los meses intermedios sin datos', async () => {
    mocks.cargarFilasAnalisis.mockResolvedValue([fila({ fecha_inicio: '2026-01-05' }), fila({ fecha_inicio: '2026-03-05' })])
    const { container } = montar(admin)
    await screen.findByText('Comparativa')
    const graficos = container.querySelectorAll('svg')
    expect(graficos).toHaveLength(2)
    graficos.forEach((g) => expect(g.querySelectorAll('.mes-col')).toHaveLength(3))
    expect(container.textContent).toContain('feb 26')
  })

  it('Exportar sigue el orden actual de la tabla', async () => {
    montar(admin)
    await screen.findByText('Comparativa')
    fireEvent.click(screen.getByRole('button', { name: 'Exportar a Excel' }))
    const orden = (i: number) =>
      (mocks.exportarComparativa.mock.calls[i] as unknown as [{ etiqueta: string }[]])[0].map((x) => x.etiqueta)
    expect(orden(0)).toEqual(['PROMO-B', 'PROMO-A'])
    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: /^Usos/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Exportar a Excel' }))
    expect(orden(1)).toEqual(['PROMO-B', 'PROMO-A'])
    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: /^Usos/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Exportar a Excel' }))
    expect(orden(2)).toEqual(['PROMO-A', 'PROMO-B'])
  })

  it('Exportar a Excel llama a exportarComparativa con las filas actuales', async () => {
    montar(admin)
    await screen.findByText('Comparativa')
    fireEvent.change(screen.getByLabelText('Agrupar por'), { target: { value: 'espacio' } })
    fireEvent.click(screen.getByRole('button', { name: 'Exportar a Excel' }))
    await waitFor(() => expect(mocks.exportarComparativa).toHaveBeenCalledTimes(1))
    const [filas, dim] = mocks.exportarComparativa.mock.calls[0] as unknown as [{ etiqueta: string }[], string]
    expect(filas.map((x) => x.etiqueta).sort()).toEqual(['TMICC', 'UFS'])
    expect(dim).toBe('Espacio')
    expect(mocks.descargar).toHaveBeenCalledTimes(1)
  })
})
