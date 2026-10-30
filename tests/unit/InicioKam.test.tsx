import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const mocks = vi.hoisted(() => ({
  cargarFilasInicio: vi.fn(),
  cargarMisConcesiones: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }))
vi.mock('../../src/app/inicio/datos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/app/inicio/datos')>()),
  cargarFilasInicio: mocks.cargarFilasInicio,
  cargarMisConcesiones: mocks.cargarMisConcesiones,
}))

import InicioKam from '../../src/app/inicio/InicioKam'
import { SesionContext, type Perfil } from '../../src/app/auth/useSesion'
import type { FilaInicio } from '../../src/dominio/tareas'

const perfil = { id: 'kam1', nombre: 'Ana', rol: 'kam', email: 'ana@x.com' } as Perfil

function fila(parcial: Partial<FilaInicio> = {}): FilaInicio {
  return {
    actualizado_en: '2026-10-30T10:00:00Z',
    concesion_id: 1,
    concesion_nombre: 'Bar Pepe',
    cupos: 10,
    cupos_revisado_en: new Date().toISOString(),
    editable: true,
    email: 'enviado',
    espacio: 'TMICC',
    estado: 'activa',
    kam_id: null,
    kam_nombre: null,
    promocion_id: 'p1',
    publicada_en: null,
    revision_cupos: 'ninguna',
    seguimiento_id: 's1',
    sms: 'enviado',
    tag: 'PROMO1',
    umbral_cupos: 0.8,
    usos: 0,
    ...parcial,
  }
}

function montar() {
  return render(
    <MemoryRouter>
      <SesionContext.Provider value={{ cargando: false, perfil, haySesion: true }}>
        <InicioKam />
      </SesionContext.Provider>
    </MemoryRouter>,
  )
}

function datos(filas: FilaInicio[], concesiones: { id: number; nombre: string }[] = []) {
  mocks.cargarFilasInicio.mockResolvedValue(filas)
  mocks.cargarMisConcesiones.mockResolvedValue(concesiones)
}

const boton = (re: RegExp) => screen.findByRole('button', { name: re })
const diasAtras = (n: number) => new Date(Date.now() - n * 86400000).toISOString()

describe('InicioKam', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('cuenta solo filas editables', async () => {
    datos([
      fila({ seguimiento_id: 's1', estado: 'pendiente' }),
      fila({ seguimiento_id: 's2', tag: 'AJENA', estado: 'pendiente', editable: false }),
    ])
    montar()
    expect(await boton(/Sin respuesta/)).toHaveTextContent('1')
  })

  it('pulsar «Sin respuesta» abre la lista con esa fila; pulsar otra vez la cierra', async () => {
    datos([fila({ estado: 'pendiente' })])
    montar()
    const b = await boton(/Sin respuesta/)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    fireEvent.click(b)
    const tabla = screen.getByRole('table')
    expect(within(tabla).getByText('Bar Pepe')).toBeInTheDocument()
    fireEvent.click(b)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('Mis concesiones: concesión sin filas al final sin etiquetas; con filas, una etiqueta por promoción', async () => {
    datos(
      [
        fila({ seguimiento_id: 's1', tag: 'B2', concesion_id: 2, concesion_nombre: 'Zeta' }),
        fila({ seguimiento_id: 's2', tag: 'A1', concesion_id: 2, concesion_nombre: 'Zeta' }),
      ],
      [{ id: 1, nombre: 'Alfa vacía' }, { id: 2, nombre: 'Zeta' }],
    )
    montar()
    expect(await screen.findByText('Mis concesiones (2)')).toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Zeta')
    expect(items[1]).toHaveTextContent('Alfa vacía')
    const etiquetas = within(items[0]).getAllByRole('button')
    expect(etiquetas.map((e) => e.textContent)).toEqual([
      expect.stringContaining('A1'),
      expect.stringContaining('B2'),
    ])
    expect(within(items[1]).queryByRole('button')).not.toBeInTheDocument()
    expect(within(items[0]).getByRole('link', { name: 'Zeta' })).toHaveAttribute('href', '/concesion/2')
  })

  it('permiso por espacio: fila editable de concesión ajena aparece en contadores y en Mis concesiones; no aparecen otras del espacio', async () => {
    datos([
      fila({ seguimiento_id: 's1', concesion_id: 9, concesion_nombre: 'Ajena', estado: 'pendiente' }),
      fila({ seguimiento_id: 's2', concesion_id: 8, concesion_nombre: 'Otra', estado: 'pendiente', editable: false }),
    ])
    montar()
    expect(await boton(/Sin respuesta/)).toHaveTextContent('1')
    expect(screen.getByText('Mis concesiones (1)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ajena' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Otra' })).not.toBeInTheDocument()
  })

  it('vacío: «Todavía no tienes concesiones asignadas»', async () => {
    datos([])
    montar()
    expect(await screen.findByText('Todavía no tienes concesiones asignadas')).toBeInTheDocument()
  })

  it('error de carga: alerta con Reintentar', async () => {
    mocks.cargarFilasInicio.mockRejectedValueOnce(new Error('fallo'))
    mocks.cargarMisConcesiones.mockResolvedValue([])
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('fallo')
    mocks.cargarFilasInicio.mockResolvedValue([])
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('PromocionesNuevas: publicada hace 2 días aparece; hace 8 días o null no', async () => {
    datos([
      fila({ seguimiento_id: 's1', tag: 'NUEVA', publicada_en: diasAtras(2) }),
      fila({ seguimiento_id: 's2', tag: 'VIEJA', publicada_en: diasAtras(8) }),
      fila({ seguimiento_id: 's3', tag: 'SINFECHA', publicada_en: null }),
    ])
    montar()
    const enlace = await screen.findByRole('link', { name: 'NUEVA' })
    expect(enlace).toHaveAttribute('href', '/tmicc/NUEVA')
    expect(screen.queryByRole('link', { name: 'VIEJA' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'SINFECHA' })).not.toBeInTheDocument()
  })
})
