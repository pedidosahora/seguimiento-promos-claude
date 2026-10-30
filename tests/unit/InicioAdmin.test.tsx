import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

const mocks = vi.hoisted(() => ({
  cargarFilasInicio: vi.fn(),
  cargarKams: vi.fn(),
  cargarRanking: vi.fn(),
}))

vi.mock('../../src/lib/supabase', () => ({ supabase: {} }))
vi.mock('../../src/app/inicio/datos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/app/inicio/datos')>()),
  cargarFilasInicio: mocks.cargarFilasInicio,
  cargarKams: mocks.cargarKams,
  cargarRanking: mocks.cargarRanking,
}))

import InicioAdmin from '../../src/app/inicio/InicioAdmin'
import RankingPromociones from '../../src/app/inicio/RankingPromociones'
import TareasPorKam from '../../src/app/inicio/TareasPorKam'
import type { FilaRanking } from '../../src/app/inicio/datos'
import { contarTareas, TAREAS, type FilaInicio } from '../../src/dominio/tareas'

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

const ahora = new Date()
const kams = [
  { id: 'k1', nombre: 'Ana' },
  { id: 'k2', nombre: 'Bea' },
  { id: 'k3', nombre: 'Cleo' },
]

function filasMixtas(): FilaInicio[] {
  return [
    fila({ seguimiento_id: 'a', kam_id: 'k1', kam_nombre: 'Ana', estado: 'pendiente' }),
    fila({ seguimiento_id: 'b', kam_id: 'k2', kam_nombre: 'Bea', estado: 'pendiente' }),
    fila({ seguimiento_id: 'c', kam_id: 'k2', kam_nombre: 'Bea', estado: 'pendiente' }),
    fila({ seguimiento_id: 'd', kam_id: 'k1', kam_nombre: 'Ana', estado: 'acepta' }),
    fila({ seguimiento_id: 'e', kam_id: null, estado: 'acepta' }),
  ]
}

function filaDe(nombre: string) {
  const r = screen
    .getAllByRole('row')
    .find((x) => within(x).queryAllByRole('cell')[0]?.textContent === nombre)
  if (!r) throw new Error('sin fila ' + nombre)
  return r
}

describe('TareasPorKam', () => {
  afterEach(cleanup)

  it('atribuye por kam_id y la suma de cada columna = contador global', () => {
    const filas = filasMixtas()
    render(<TareasPorKam filas={filas} kams={kams} ahora={ahora} onElegir={() => {}} />)
    const global = contarTareas(filas, ahora)
    const nombres = ['Ana', 'Bea', 'Cleo', 'Sin KAM']
    TAREAS.forEach(({ clave, etiqueta }, i) => {
      const suma = nombres.reduce((s, n) => {
        const celda = within(filaDe(n)).getAllByRole('cell')[i + 1]
        return s + Number(celda.textContent)
      }, 0)
      expect(suma, etiqueta).toBe(global[clave])
    })
    expect(within(filaDe('Bea')).getAllByRole('cell')[1]).toHaveTextContent('2')
    expect(within(filaDe('Ana')).getAllByRole('cell')[2]).toHaveTextContent('1')
  })

  it('incluye KAM a cero; «Sin KAM» solo si hay filas sin kam', () => {
    const conSin = render(
      <TareasPorKam filas={filasMixtas()} kams={kams} ahora={ahora} onElegir={() => {}} />,
    )
    within(filaDe('Cleo'))
      .getAllByRole('cell')
      .slice(1)
      .forEach((c) => expect(c.textContent).toBe('0'))
    expect(filaDe('Sin KAM')).toBeInTheDocument()
    conSin.unmount()
    render(
      <TareasPorKam
        filas={filasMixtas().filter((f) => f.kam_id)}
        kams={kams}
        ahora={ahora}
        onElegir={() => {}}
      />,
    )
    expect(filaDe('Cleo')).toBeInTheDocument()
    expect(() => filaDe('Sin KAM')).toThrow()
  })

  it('KAM con kam_id fuera de kams: fila propia con kam_nombre y sumas = global', () => {
    const filas = [
      ...filasMixtas(),
      fila({ seguimiento_id: 'z', kam_id: 'k9', kam_nombre: 'Zoe', estado: 'pendiente' }),
      fila({ seguimiento_id: 'y', kam_id: 'k8', kam_nombre: null, estado: 'pendiente' }),
    ]
    render(<TareasPorKam filas={filas} kams={kams} ahora={ahora} onElegir={() => {}} />)
    expect(within(filaDe('Zoe')).getAllByRole('cell')[1].textContent).toBe('1')
    expect(within(filaDe('KAM desconocido')).getAllByRole('cell')[1].textContent).toBe('1')
    const total = ['Ana', 'Bea', 'Cleo', 'Zoe', 'KAM desconocido', 'Sin KAM'].reduce(
      (n, k) => n + Number(within(filaDe(k)).getAllByRole('cell')[1].textContent),
      0,
    )
    expect(total).toBe(contarTareas(filas, ahora).sin_respuesta)
  })

  it('ordena por Sin respuesta desc y luego por nombre', () => {
    render(<TareasPorKam filas={filasMixtas()} kams={kams} ahora={ahora} onElegir={() => {}} />)
    const nombres = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getAllByRole('cell')[0].textContent)
    expect(nombres).toEqual(['Bea', 'Ana', 'Cleo', 'Sin KAM'])
  })

  it('solo las celdas > 0 son botones y llaman a onElegir(kamId, tarea)', () => {
    const onElegir = vi.fn()
    render(<TareasPorKam filas={filasMixtas()} kams={kams} ahora={ahora} onElegir={onElegir} />)
    expect(within(filaDe('Cleo')).queryByRole('button')).not.toBeInTheDocument()
    fireEvent.click(within(filaDe('Bea')).getByRole('button'))
    expect(onElegir).toHaveBeenCalledWith('k2', 'sin_respuesta')
    fireEvent.click(within(filaDe('Sin KAM')).getByRole('button'))
    expect(onElegir).toHaveBeenLastCalledWith(null, 'sin_activar')
  })
})

describe('RankingPromociones', () => {
  afterEach(cleanup)

  const r = (parcial: Partial<FilaRanking>): FilaRanking => ({
    promocion_id: 'x',
    tag: 'X',
    espacio: 'TMICC',
    usos: 0,
    cupos: 10,
    gsv: 0,
    activas: 0,
    pct: 0,
    ...parcial,
  })

  it('10/10 antes que 5/10; cupos 0 al final con «—»', () => {
    render(
      <MemoryRouter>
        <RankingPromociones
          filas={[
            r({ promocion_id: '1', tag: 'MEDIA', usos: 5, cupos: 10, pct: 0.5 }),
            r({ promocion_id: '2', tag: 'SINCUPOS', usos: 0, cupos: 0, pct: null }),
            r({ promocion_id: '3', tag: 'LLENA', usos: 10, cupos: 10, pct: 1 }),
          ]}
        />
      </MemoryRouter>,
    )
    const filas = screen.getAllByRole('row').slice(1)
    expect(filas.map((f) => within(f).getByRole('link').textContent)).toEqual([
      'LLENA',
      'MEDIA',
      'SINCUPOS',
    ])
    expect(filas[0]).toHaveTextContent('100%')
    expect(filas[1]).toHaveTextContent('50%')
    expect(within(filas[2]).getAllByRole('cell')[2]).toHaveTextContent('—')
    expect(within(filas[0]).getByRole('link')).toHaveAttribute('href', '/tmicc/LLENA')
  })
})

describe('InicioAdmin', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  function montar() {
    return render(
      <MemoryRouter>
        <InicioAdmin />
      </MemoryRouter>,
    )
  }

  it('pulsar celda de un KAM muestra ListaTareas solo con filas de ese KAM', async () => {
    mocks.cargarFilasInicio.mockResolvedValue([
      fila({ seguimiento_id: 'a', concesion_nombre: 'De Ana', kam_id: 'k1', kam_nombre: 'Ana', estado: 'pendiente' }),
      fila({ seguimiento_id: 'b', concesion_nombre: 'De Bea', kam_id: 'k2', kam_nombre: 'Bea', estado: 'pendiente' }),
    ])
    mocks.cargarKams.mockResolvedValue(kams)
    mocks.cargarRanking.mockResolvedValue([])
    montar()
    await screen.findByText('Tareas por KAM')
    const celdaAna = within(filaDe('Ana')).getByRole('button')
    expect(screen.queryByText('De Ana')).not.toBeInTheDocument()
    fireEvent.click(celdaAna)
    expect(screen.getByText('De Ana')).toBeInTheDocument()
    expect(screen.queryByText('De Bea')).not.toBeInTheDocument()
  })

  it('celda de KAM: lista bajo la tabla con encabezado, solo esa tarea y ese KAM; segundo clic cierra', async () => {
    mocks.cargarFilasInicio.mockResolvedValue([
      fila({ seguimiento_id: 'a', concesion_nombre: 'Pend Ana', kam_id: 'k1', kam_nombre: 'Ana', estado: 'pendiente' }),
      fila({ seguimiento_id: 'd', concesion_nombre: 'Acep Ana', kam_id: 'k1', kam_nombre: 'Ana', estado: 'acepta' }),
      fila({ seguimiento_id: 'b', concesion_nombre: 'Pend Bea', kam_id: 'k2', kam_nombre: 'Bea', estado: 'pendiente' }),
    ])
    mocks.cargarKams.mockResolvedValue(kams)
    mocks.cargarRanking.mockResolvedValue([])
    montar()
    await screen.findByText('Tareas por KAM')
    fireEvent.click(within(filaDe('Ana')).getByRole('button', { name: /Sin respuesta/ }))
    expect(screen.getByRole('heading', { name: /Ana · Sin respuesta/ })).toBeInTheDocument()
    expect(screen.getByText('Pend Ana')).toBeInTheDocument()
    expect(screen.queryByText('Acep Ana')).not.toBeInTheDocument()
    expect(screen.queryByText('Pend Bea')).not.toBeInTheDocument()
    const tablas = screen.getAllByRole('table')
    const resumen = tablas.find((t) => within(t).queryByText('Total'))!
    const lista = tablas.find((t) => within(t).queryByText('Pend Ana'))!
    expect(resumen.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(within(filaDe('Ana')).getByRole('button', { name: /Sin respuesta/ }))
    expect(screen.queryByText('Pend Ana')).not.toBeInTheDocument()
    fireEvent.click(within(filaDe('Ana')).getByRole('button', { name: /Sin respuesta/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByText('Pend Ana')).not.toBeInTheDocument()
  })

  it('contador global abre ListaTareas con todas las filas y columna KAM', async () => {
    mocks.cargarFilasInicio.mockResolvedValue([
      fila({ seguimiento_id: 'a', concesion_nombre: 'De Ana', kam_id: 'k1', kam_nombre: 'Ana', estado: 'pendiente' }),
      fila({ seguimiento_id: 'b', concesion_nombre: 'De Bea', kam_id: 'k2', kam_nombre: 'Bea', estado: 'pendiente' }),
    ])
    mocks.cargarKams.mockResolvedValue(kams)
    mocks.cargarRanking.mockResolvedValue([])
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /^2 Sin respuesta/ }))
    expect(screen.getByText('De Ana')).toBeInTheDocument()
    expect(screen.getByText('De Bea')).toBeInTheDocument()
    expect(within(screen.getAllByRole('table')[0]).getByRole('columnheader', { name: 'KAM' })).toBeInTheDocument()
    expect(within(screen.getAllByRole('table')[0]).getByRole('columnheader', { name: 'Concesión' })).toBeInTheDocument()
  })

  it('error de carga: alerta con Reintentar', async () => {
    mocks.cargarFilasInicio.mockRejectedValueOnce(new Error('fallo'))
    mocks.cargarKams.mockResolvedValue([])
    mocks.cargarRanking.mockResolvedValue([])
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent('fallo')
    mocks.cargarFilasInicio.mockResolvedValue([])
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Tareas por KAM')).toBeInTheDocument()
  })
})
