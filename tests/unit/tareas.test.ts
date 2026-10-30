import { describe, expect, it } from 'vitest'
import {
  contarTareas,
  hayAgotadas,
  TAREAS,
  tareasDeFila,
  type FilaInicio,
} from '../../src/dominio/tareas'

const ahora = new Date('2026-10-30T10:00:00Z')

function fila(parcial: Partial<FilaInicio> = {}): FilaInicio {
  return {
    actualizado_en: '2026-10-30T10:00:00Z',
    concesion_id: 1,
    concesion_nombre: 'Concesión',
    cupos: 10,
    cupos_revisado_en: ahora.toISOString(),
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
    tag: 'T',
    umbral_cupos: 0.8,
    usos: 0,
    ...parcial,
  }
}

const diasAntes = (d: number) => new Date(ahora.getTime() - d * 86400000).toISOString()

describe('tareas', () => {
  it('lista las cinco tareas en orden', () => {
    expect(TAREAS.map((t) => t.etiqueta)).toEqual([
      'Sin respuesta',
      'Aceptadas sin activar',
      'Cupos al límite',
      'Revisión semanal',
      'Envíos pendientes',
    ])
  })

  it('sin respuesta y sin activar', () => {
    expect(tareasDeFila(fila({ estado: 'pendiente' }), ahora)).toEqual(['sin_respuesta'])
    expect(tareasDeFila(fila({ estado: 'acepta', usos: 0 }), ahora)).toEqual(['sin_activar'])
  })

  it('cupos', () => {
    const t = (p: Partial<FilaInicio>) => tareasDeFila(fila(p), ahora)
    expect(t({ estado: 'acepta', usos: 8 })).toContain('cupos')
    expect(t({ estado: 'activa', usos: 7 })).not.toContain('cupos')
    expect(t({ estado: 'activa', usos: 10 })).toContain('cupos')
    expect(t({ estado: 'pendiente', usos: 9 })).not.toContain('cupos')
    expect(t({ cupos: null, usos: 9 })).not.toContain('cupos')
    expect(t({ cupos: 0, usos: 9 })).not.toContain('cupos')
  })

  it('revisión', () => {
    const t = (p: Partial<FilaInicio>) => tareasDeFila(fila(p), ahora)
    const semanal = { revision_cupos: 'semanal' as const }
    expect(t({ ...semanal, cupos_revisado_en: '2026-10-23T09:59:59Z' })).toContain('revision')
    expect(t({ ...semanal, cupos_revisado_en: '2026-10-23T10:00:00Z' })).not.toContain('revision')
    const quincenal = { revision_cupos: 'quincenal' as const }
    expect(t({ ...quincenal, cupos_revisado_en: diasAntes(10) })).not.toContain('revision')
    expect(t({ ...quincenal, cupos_revisado_en: diasAntes(15) })).toContain('revision')
    expect(
      t({ revision_cupos: 'ninguna', cupos_revisado_en: diasAntes(30) }),
    ).not.toContain('revision')
    expect(
      t({ ...semanal, estado: 'acepta', cupos_revisado_en: diasAntes(30) }),
    ).not.toContain('revision')
    expect(t({ ...semanal, cupos_revisado_en: null })).toContain('revision')
  })

  it('envíos', () => {
    const t = (p: Partial<FilaInicio>) => tareasDeFila(fila(p), ahora)
    expect(t({ estado: 'activa', sms: 'pending' })).toContain('envios')
    expect(t({ estado: 'pendiente', email: 'pending' })).toContain('envios')
    expect(t({ estado: 'no_entra', sms: 'pending' })).not.toContain('envios')
    expect(t({ estado: 'rechaza', email: 'pending' })).not.toContain('envios')
  })

  it('contarTareas suma por clave y rellena con 0', () => {
    const filas = [
      fila({ estado: 'pendiente' }),
      fila({ estado: 'pendiente' }),
      fila({ estado: 'acepta' }),
    ]
    expect(contarTareas(filas, ahora)).toEqual({
      sin_respuesta: 2,
      sin_activar: 1,
      cupos: 0,
      revision: 0,
      envios: 0,
    })
  })

  it('hayAgotadas', () => {
    expect(hayAgotadas([fila({ estado: 'activa', usos: 10 })])).toBe(true)
    expect(hayAgotadas([fila({ estado: 'activa', usos: 9 })])).toBe(false)
  })
})
