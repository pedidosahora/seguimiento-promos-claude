import { afterEach, describe, expect, it, vi } from 'vitest'
import { hoyISO } from '../../src/dominio/fechas'

describe('hoyISO', () => {
  afterEach(() => vi.useRealTimers())

  it('usa la fecha local, no UTC, a las 00:30', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 28, 0, 30))
    expect(hoyISO()).toBe('2026-10-28')
  })
})
