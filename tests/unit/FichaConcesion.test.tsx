import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const seguimientos = [
  { id: 's1', estado: 'activa', cupos: 10, usos: 9, gsv: 1234.5, promociones: { tag: 'BETA', espacio: 'TMICC', umbral_cupos: 0.8 } },
  { id: 's2', estado: 'pendiente', cupos: 10, usos: 2, gsv: 10, promociones: { tag: 'ALFA', espacio: 'UFS', umbral_cupos: 0.8 } },
  { id: 's3', estado: 'activa', cupos: 10, usos: 10, gsv: 0, promociones: { tag: 'GAMMA', espacio: 'TMICC', umbral_cupos: 0.8 } },
]
const concesion = {
  id: 7, razon_social: 'Bar Pepe SL', nombre_comercial: 'Bar Pepe', activa: true,
  territorios: { nombre: 'Norte' }, kam: { nombre: 'Ana' },
}
const selects: string[] = []

vi.mock('../../src/lib/supabase', () => {
  const construir = (tabla: string) => {
    const resultado = { data: tabla === 'seguimiento' ? seguimientos : concesion, error: null }
    const b: Record<string, unknown> = {}
    b.select = (q: string) => {
      selects.push(`${tabla}:${q}`)
      return b
    }
    b.eq = () => b
    b.maybeSingle = () => Promise.resolve(resultado)
    b.then = (ok: (r: typeof resultado) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve(resultado).then(ok, ko)
    return b
  }
  return { supabase: { from: construir } }
})

import FichaConcesion from '../../src/app/promocion/FichaConcesion'

function montar(entrada: string | { pathname: string; state: unknown } = '/concesion/7') {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route path="/concesion/:id" element={<FichaConcesion />} />
        <Route path="/" element={<p>Inicio</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('FichaConcesion', () => {
  afterEach(cleanup)

  it('muestra las columnas, el ⚠ de cupos y amplía el select de seguimiento', async () => {
    montar()
    await screen.findByText('BETA')
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent?.trim())).toEqual([
      'TAG', 'Espacio', 'Estado en la promoción', 'Cupos', 'Usos', '% cupos', 'GSV',
    ])
    const seg = selects.find((s) => s.startsWith('seguimiento:'))!
    expect(seg).toContain('cupos')
    expect(seg).toContain('umbral_cupos')
    const fila = (tag: string) => screen.getByText(tag).closest('tr') as HTMLElement
    const cerca = within(fila('BETA')).getByText(/⚠/)
    expect(cerca).toHaveTextContent('90 %')
    expect(cerca).toHaveClass('cerca')
    expect(within(fila('GAMMA')).getByText(/⚠/)).toHaveClass('agotado')
    expect(within(fila('ALFA')).queryByText(/⚠/)).not.toBeInTheDocument()
    expect(within(fila('ALFA')).getByText('20 %')).toBeInTheDocument()
  })

  it('«← Inicio» lleva a inicio cuando no hay historial previo ni origen', async () => {
    montar()
    fireEvent.click(await screen.findByRole('link', { name: '← Inicio' }))
    await waitFor(() => expect(screen.getByText('Inicio')).toBeInTheDocument())
  })

  it('con origen en el estado del enlace, «volver» nombra y enlaza ese destino', async () => {
    montar({ pathname: '/concesion/7', state: { desde: { texto: 'TMICC-1', ruta: '/tmicc/TMICC-1' } } })
    expect(await screen.findByRole('link', { name: '← TMICC-1' })).toHaveAttribute('href', '/tmicc/TMICC-1')
  })

  it('pulsar «% cupos» ordena por valor numérico; la tercera vez restaura el orden por defecto', async () => {
    montar()
    await screen.findByText('BETA')
    const tags = () =>
      screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent)
    expect(tags()).toEqual(['ALFA', 'BETA', 'GAMMA'])
    const cabecera = screen.getByRole('button', { name: '% cupos' })
    fireEvent.click(cabecera)
    expect(tags()).toEqual(['ALFA', 'BETA', 'GAMMA'])
    fireEvent.click(cabecera)
    expect(tags()).toEqual(['GAMMA', 'BETA', 'ALFA'])
    fireEvent.click(cabecera)
    expect(tags()).toEqual(['ALFA', 'BETA', 'GAMMA'])
  })
})
