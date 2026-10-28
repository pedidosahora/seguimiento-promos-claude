import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

vi.mock('../../src/lib/supabase', () => {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order', 'in', 'limit']) b[m] = () => b
  b.then = (ok: (r: unknown) => unknown, ko?: (e: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(ok, ko)
  return { supabase: { from: () => b, rpc: () => Promise.resolve({ data: null, error: null }) } }
})

import FichaLateral from '../../src/app/promocion/FichaLateral'
import type { FilaGrid } from '../../src/app/promocion/servicio'

const fila = (usos: number): FilaGrid => ({
  id: 'f1', promocion_id: 'p1', concesion_id: 9100, estado: 'activa',
  fecha_aceptacion: null, fecha_activacion: null, cupos: 50, usos, gsv: 0,
  fecha_dato: null, sms: 'pending', email: 'pending', actualizado_en: '2026-10-01T10:00:00Z',
  nombre: 'Alfa', kam_id: 'k1', kam_nombre: 'Ana', territorio: 'Norte',
})

function montar(usos: number) {
  return render(
    <MemoryRouter>
      <FichaLateral fila={fila(usos)} umbral={0.8} editable={false} esAdmin={false}
        perfilId="k1" onCerrar={vi.fn()} onDeshecho={vi.fn()} />
    </MemoryRouter>,
  )
}

describe('FichaLateral', () => {
  afterEach(cleanup)

  it('⚠ junto al %Cupos en cerca (amarillo) y en agotado (rojo)', () => {
    montar(45)
    const cerca = screen.getByText(/90 %/)
    expect(cerca.textContent).toContain('⚠')
    expect(cerca.className).toMatch(/alerta-cerca/)
    cleanup()
    montar(52)
    const agotado = screen.getByText(/104 %/)
    expect(agotado.textContent).toContain('⚠')
    expect(agotado.className).toMatch(/alerta-agotado/)
    cleanup()
    montar(10)
    expect(screen.getByText(/20 %/).textContent).not.toContain('⚠')
  })
})
