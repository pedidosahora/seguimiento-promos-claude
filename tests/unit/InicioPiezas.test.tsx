import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const mocks = vi.hoisted(() => ({
  guardarDesdeInicio: vi.fn(),
  recargarFila: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }))
vi.mock('../../src/app/inicio/datos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/app/inicio/datos')>()),
  guardarDesdeInicio: mocks.guardarDesdeInicio,
  recargarFila: mocks.recargarFila,
}))

import Contadores from '../../src/app/inicio/Contadores'
import EtiquetaEstado from '../../src/app/inicio/EtiquetaEstado'
import ListaTareas from '../../src/app/inicio/ListaTareas'
import { ConflictoError } from '../../src/app/promocion/servicio'
import type { FilaInicio, Tarea } from '../../src/dominio/tareas'

const ahora = new Date('2026-10-30T10:00:00Z')

function fila(parcial: Partial<FilaInicio> = {}): FilaInicio {
  return {
    actualizado_en: '2026-10-30T10:00:00Z',
    concesion_id: 1,
    concesion_nombre: 'Bar Pepe',
    cupos: 10,
    cupos_revisado_en: ahora.toISOString(),
    editable: true,
    email: 'enviado',
    espacio: 'TMICC',
    estado: 'pendiente',
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

const conteos = (p: Partial<Record<Tarea, number>> = {}): Record<Tarea, number> => ({
  sin_respuesta: 0,
  sin_activar: 0,
  cupos: 0,
  revision: 0,
  envios: 0,
  ...p,
})

const montar = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

afterEach(() => {
  cleanup()
  mocks.guardarDesdeInicio.mockReset()
  mocks.recargarFila.mockReset()
})

describe('Contadores', () => {
  it('muestra los cinco con su número y llama onElegir', () => {
    const onElegir = vi.fn()
    render(
      <Contadores
        conteos={conteos({ sin_respuesta: 3, envios: 1 })}
        agotadas={false}
        activa="envios"
        onElegir={onElegir}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(5)
    const sin = screen.getByRole('button', { name: /Sin respuesta/ })
    expect(sin).toHaveTextContent('3')
    expect(sin).toHaveClass('aviso')
    expect(screen.getByRole('button', { name: /Cupos al límite/ })).not.toHaveClass('aviso')
    expect(screen.getByRole('button', { name: /Envíos pendientes/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(sin)
    expect(onElegir).toHaveBeenCalledWith('sin_respuesta')
  })

  it('marca peligro en cupos si hay agotadas', () => {
    render(
      <Contadores conteos={conteos({ cupos: 2 })} agotadas activa={null} onElegir={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /Cupos al límite/ })).toHaveClass('peligro')
    expect(screen.getByRole('button', { name: /Sin respuesta/ })).not.toHaveClass('peligro')
  })
})

describe('ListaTareas', () => {
  it("sin_respuesta: elegir 'acepta' guarda { estado } y luego llama onCambio", async () => {
    const nueva = fila({ estado: 'acepta' })
    mocks.guardarDesdeInicio.mockResolvedValue(nueva)
    const f = fila()
    const onCambio = vi.fn()
    montar(<ListaTareas tarea="sin_respuesta" filas={[f]} ahora={ahora} onCambio={onCambio} />)
    expect(screen.getByRole('link', { name: 'PROMO1' })).toHaveAttribute('href', '/tmicc/PROMO1')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'acepta' } })
    await waitFor(() => expect(onCambio).toHaveBeenCalledWith(nueva))
    expect(mocks.guardarDesdeInicio).toHaveBeenCalledWith(f, { estado: 'acepta' })
  })

  it('revision: «Revisado, sin cambios» guarda solo cupos_revisado_en (ISO)', async () => {
    const f = fila({ estado: 'activa', revision_cupos: 'semanal', cupos_revisado_en: null })
    mocks.guardarDesdeInicio.mockResolvedValue(f)
    const onCambio = vi.fn()
    montar(<ListaTareas tarea="revision" filas={[f]} ahora={ahora} onCambio={onCambio} />)
    fireEvent.click(screen.getByRole('button', { name: 'Revisado, sin cambios' }))
    await waitFor(() => expect(onCambio).toHaveBeenCalled())
    const [, cambios] = mocks.guardarDesdeInicio.mock.calls[0]
    expect(Object.keys(cambios)).toEqual(['cupos_revisado_en'])
    expect(new Date(cambios.cupos_revisado_en).toISOString()).toBe(cambios.cupos_revisado_en)
  })

  it('cupos: guarda el número; vacío no guarda; inválido muestra aviso', async () => {
    const f = fila({ estado: 'activa', cupos: 10, usos: 9 })
    mocks.guardarDesdeInicio.mockResolvedValue(f)
    montar(<ListaTareas tarea="cupos" filas={[f]} ahora={ahora} onCambio={() => {}} />)
    const input = screen.getByRole('spinbutton')
    const guardar = screen.getByRole('button', { name: 'Guardar' })
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.click(guardar)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: '-3' } })
    fireEvent.click(guardar)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(mocks.guardarDesdeInicio).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '20' } })
    fireEvent.click(guardar)
    await waitFor(() => expect(mocks.guardarDesdeInicio).toHaveBeenCalledWith(f, { cupos: 20 }))
  })

  it('conflicto: muestra «Esta fila ha cambiado; recarga» y recarga la fila', async () => {
    const f = fila()
    const recargada = fila({ estado: 'acepta' })
    mocks.guardarDesdeInicio.mockRejectedValue(new ConflictoError())
    mocks.recargarFila.mockResolvedValue(recargada)
    const onCambio = vi.fn()
    montar(<ListaTareas tarea="sin_respuesta" filas={[f]} ahora={ahora} onCambio={onCambio} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'acepta' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta fila ha cambiado; recarga')
    expect(mocks.recargarFila).toHaveBeenCalledWith('s1')
    await waitFor(() => expect(onCambio).toHaveBeenCalledWith(recargada))
  })

  it('otro error: muestra su mensaje', async () => {
    mocks.guardarDesdeInicio.mockRejectedValue(new Error('sin permiso'))
    montar(<ListaTareas tarea="sin_respuesta" filas={[fila()]} ahora={ahora} onCambio={() => {}} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'acepta' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('sin permiso')
  })

  it('fila no editable: solo lectura, sin controles', () => {
    montar(
      <ListaTareas
        tarea="revision"
        filas={[fila({ editable: false, estado: 'activa', revision_cupos: 'semanal', cupos_revisado_en: null })]}
        ahora={ahora}
        onCambio={() => {}}
      />,
    )
    expect(screen.getByText('PROMO1')).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('doble envío: un segundo clic con el guardado en curso no vuelve a guardar', async () => {
    let resolver: (f: FilaInicio) => void = () => {}
    mocks.guardarDesdeInicio.mockReturnValue(new Promise<FilaInicio>((r) => (resolver = r)))
    const f = fila({ estado: 'activa', revision_cupos: 'semanal', cupos_revisado_en: null })
    const onCambio = vi.fn()
    montar(<ListaTareas tarea="revision" filas={[f]} ahora={ahora} onCambio={onCambio} />)
    const boton = screen.getByRole('button', { name: 'Revisado, sin cambios' })
    fireEvent.click(boton)
    fireEvent.click(boton)
    expect(mocks.guardarDesdeInicio).toHaveBeenCalledTimes(1)
    expect(boton).toBeDisabled()
    resolver(f)
    await waitFor(() => expect(onCambio).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(boton).toBeEnabled())
  })

  it('el input de cupos se resincroniza cuando la fila se recarga', () => {
    const f = fila({ estado: 'activa', cupos: 10, usos: 9 })
    const props = { tarea: 'cupos' as const, ahora, onCambio: () => {} }
    const { rerender } = montar(<ListaTareas {...props} filas={[f]} />)
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '15' } })
    expect(input).toHaveValue(15)
    const recargada = fila({
      estado: 'activa',
      cupos: 11,
      usos: 9,
      actualizado_en: '2026-10-30T10:05:00Z',
    })
    rerender(
      <MemoryRouter>
        <ListaTareas {...props} filas={[recargada]} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('spinbutton')).toHaveValue(11)
  })

  it('mostrarKam añade la columna KAM', () => {
    montar(
      <ListaTareas
        tarea="sin_respuesta"
        filas={[fila({ kam_nombre: 'Ana' })]}
        ahora={ahora}
        onCambio={() => {}}
        mostrarKam
      />,
    )
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })
})

describe('EtiquetaEstado', () => {
  it('no editable: no muestra select al pulsar', () => {
    montar(<EtiquetaEstado fila={fila({ editable: false })} ahora={ahora} onCambio={() => {}} />)
    expect(screen.getByText(/PROMO1 · Pendiente/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/PROMO1/))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it("editable: pulsar → select → 'rechaza' guarda { estado: 'rechaza' }", async () => {
    const f = fila()
    const nueva = fila({ estado: 'rechaza' })
    mocks.guardarDesdeInicio.mockResolvedValue(nueva)
    const onCambio = vi.fn()
    montar(<EtiquetaEstado fila={f} ahora={ahora} onCambio={onCambio} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rechaza' } })
    await waitFor(() => expect(onCambio).toHaveBeenCalledWith(nueva))
    expect(mocks.guardarDesdeInicio).toHaveBeenCalledWith(f, { estado: 'rechaza' })
  })

  it('con usos 9 / cupos 10 / umbral 0.8 muestra ⚠ y 90 %', () => {
    montar(
      <EtiquetaEstado
        fila={fila({ estado: 'activa', usos: 9, cupos: 10, editable: false })}
        ahora={ahora}
        onCambio={() => {}}
      />,
    )
    expect(screen.getByText(/⚠/)).toHaveTextContent('90 %')
    expect(screen.getByText(/⚠/)).toHaveClass('cerca')
  })
})
