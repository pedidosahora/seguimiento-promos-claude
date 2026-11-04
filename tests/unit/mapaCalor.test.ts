import { describe, expect, it } from 'vitest'
import { posicionesEnColumna } from '../../src/analisis/mapaCalor'

describe('posicionesEnColumna', () => {
  it('va de 0 (menor) a 1 (mayor), también en valores desordenados', () => {
    expect(posicionesEnColumna([20, 10, 30])).toEqual([0.5, 0, 1])
  })

  it('un valor muy extremo no deja al resto sin diferenciar', () => {
    expect(posicionesEnColumna([1, 2, 3, 6268])).toEqual([0, 1 / 3, 2 / 3, 1])
  })

  it('los valores repetidos comparten posición', () => {
    expect(posicionesEnColumna([5, 5, 9])).toEqual([0, 0, 1])
  })

  it('sin dato: null, sin contarlo en la escala', () => {
    expect(posicionesEnColumna([null, 1, undefined, 3])).toEqual([null, 0, null, 1])
  })

  it('columna igual, un solo dato o vacía: nada que comparar', () => {
    expect(posicionesEnColumna([35, 35, 35])).toEqual([null, null, null])
    expect(posicionesEnColumna([7, null])).toEqual([null, null])
    expect(posicionesEnColumna([])).toEqual([])
  })
})
