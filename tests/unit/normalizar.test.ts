import { describe, expect, it } from 'vitest'
import {
  aFechaHoraISO,
  aFechaISO,
  aId,
  aNumero,
  mapearEnvio,
  mapearEstado,
  normalizarCabecera,
  normalizarTag,
} from '../../src/importar/normalizar'

describe('normalizar', () => {
  it('aNumero', () => {
    expect(aNumero(7)).toBe(7)
    expect(aNumero('18')).toBe(18)
    expect(aNumero('102,06')).toBe(102.06)
    expect(aNumero('1.234,5')).toBe(1234.5)
    expect(aNumero('102.06')).toBe(102.06)
    expect(aNumero('-')).toBeNull()
    expect(aNumero('—')).toBeNull()
    expect(aNumero('#VALUE!')).toBeNull()
    expect(aNumero('')).toBeNull()
    expect(aNumero(null)).toBeNull()
    expect(aNumero('abc')).toBeNaN()
  })
  it('tag, cabecera, mapeos', () => {
    expect(normalizarTag(' 3experienciac326 ')).toBe('3EXPERIENCIAC326')
    expect(normalizarTag('  ')).toBeNull()
    expect(mapearEnvio('Si')).toBe('enviado')
    expect(mapearEnvio('No hay')).toBe('no_hay')
    expect(mapearEstado('No entra')).toBe('no_entra')
    expect(mapearEstado(' ACTIVA ')).toBe('activa')
    expect(mapearEstado('zzz')).toBeNull()
    expect(normalizarCabecera('➤Status')).toBe('status')
    expect(normalizarCabecera('Concesión')).toBe('concesion')
  })
  it('aFechaISO', () => {
    expect(aFechaISO(new Date(2026, 9, 26))).toBe('2026-10-26')
    expect(aFechaISO('26/10/2026')).toBe('2026-10-26')
    expect(aFechaISO(46321)).toBe('2026-10-26')
    expect(aFechaISO(null)).toBeNull()
  })
  it('aFechaISO devuelve undefined si la fecha es imposible', () => {
    expect(aFechaISO('31/02/2026')).toBeUndefined()
    expect(aFechaISO('xx')).toBeUndefined()
    expect(aFechaISO(NaN)).toBeUndefined()
    expect(aFechaISO(Infinity)).toBeUndefined()
    expect(aFechaISO(new Date('x'))).toBeUndefined()
    expect(aFechaISO('')).toBeNull()
    expect(aFechaISO('29/02/2028')).toBe('2028-02-29')
  })
  it('aId', () => {
    expect(aId(900)).toBe(900)
    expect(aId(' 12 ')).toBe(12)
    expect(aId('2147483647')).toBe(2147483647)
    expect(aId('')).toBeNull()
    expect(aId(null)).toBeNull()
    for (const malo of [0, -3, '0', '-3', '1e3', '0x10', '2147483648', 1.5, '1.5', NaN, 'abc'])
      expect(aId(malo)).toBeNaN()
  })
  it('mapearEnvio acepta tildes', () => {
    expect(mapearEnvio('Sí')).toBe('enviado')
    expect(mapearEnvio(' SÍ ')).toBe('enviado')
  })
})

describe('aFechaHoraISO', () => {
  it('vacío → null, inválido → undefined, válido → ISO', () => {
    expect(aFechaHoraISO('')).toBeNull()
    expect(aFechaHoraISO(null)).toBeNull()
    expect(aFechaHoraISO('basura')).toBeUndefined()
    expect(aFechaHoraISO('31/02/2026 10:00')).toBeUndefined()
    expect(aFechaHoraISO(new Date('x'))).toBeUndefined()
    expect(aFechaHoraISO(-5)).toBeUndefined()
  })

  it('devuelve el instante UTC real (Europe/Madrid, verano UTC+2, invierno UTC+1)', () => {
    expect(new Date(2026, 8, 10, 9, 30).getTimezoneOffset()).toBe(-120)
    expect(aFechaHoraISO('10/09/2026 09:30')).toBe('2026-09-10T07:30:00.000Z')
    expect(aFechaHoraISO('10/01/2026 09:30')).toBe('2026-01-10T08:30:00.000Z')
    expect(aFechaHoraISO(new Date(Date.UTC(2026, 8, 10, 7, 30)))).toBe('2026-09-10T07:30:00.000Z')
    // Serie de Excel: 46275.395833... = 2026-09-10 09:30 local
    expect(aFechaHoraISO(46275 + 9.5 / 24)).toBe('2026-09-10T07:30:00.000Z')
  })
})
