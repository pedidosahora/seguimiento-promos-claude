import { beforeEach, describe, expect, it } from 'vitest'
import { admin, clienteComo, crearUsuario, resetDatos } from './ayuda'

const hoy = () => new Date().toISOString().slice(0, 10)
const dias = (n: number) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

let anaId: string
let promo: string

async function escenario() {
  await resetDatos()
  const a = admin()
  await crearUsuario({ email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' })
  anaId = (
    await crearUsuario({ email: 'ana@pro.agency', nombre: 'Ana', rol: 'kam' })
  ).perfilId
  const beaId = (
    await crearUsuario({ email: 'bea@pro.agency', nombre: 'Bea', rol: 'kam' })
  ).perfilId
  await a.from('concesiones').insert([
    { id: 900, razon_social: 'C900', kam_id: anaId },
    { id: 901, razon_social: 'C901', kam_id: beaId },
  ])
  const { data, error } = await a
    .from('promociones')
    .insert({
      tag: 'T1',
      espacio: 'TMICC',
      marca: 'TMICC',
      mecanica: 'm',
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-02-01',
      estado: 'publicada',
    })
    .select('id')
    .single()
  if (error) throw error
  promo = data.id
  const { error: e2 } = await a.from('seguimiento').insert([
    { promocion_id: promo, concesion_id: 900 },
    { promocion_id: promo, concesion_id: 901 },
  ])
  if (e2) throw e2
}

describe('seguimiento', () => {
  beforeEach(escenario)

  it('kam edita su fila', async () => {
    const ana = await clienteComo('ana@pro.agency')
    const { error } = await ana
      .from('seguimiento')
      .update({ estado: 'acepta' })
      .eq('concesion_id', 900)
    expect(error).toBeNull()
    const { data } = await admin()
      .from('seguimiento')
      .select('fecha_aceptacion')
      .eq('concesion_id', 900)
      .single()
    expect(data?.fecha_aceptacion).not.toBeNull()
  })

  it('kam no edita fila ajena', async () => {
    const ana = await clienteComo('ana@pro.agency')
    const { error } = await ana
      .from('seguimiento')
      .update({ estado: 'acepta' })
      .eq('concesion_id', 901)
    expect(error?.message).toContain('Sin permiso')
  })

  it('permiso extra vigente permite editar', async () => {
    await admin()
      .from('permisos_extra')
      .insert({ perfil_id: anaId, concesion_id: 901, caduca: hoy() })
    const ana = await clienteComo('ana@pro.agency')
    const { error } = await ana
      .from('seguimiento')
      .update({ estado: 'acepta' })
      .eq('concesion_id', 901)
    expect(error).toBeNull()
  })

  it('permiso extra caducado ayer no permite editar', async () => {
    await admin()
      .from('permisos_extra')
      .insert({ perfil_id: anaId, concesion_id: 901, caduca: dias(-1) })
    const ana = await clienteComo('ana@pro.agency')
    const { error } = await ana
      .from('seguimiento')
      .update({ estado: 'acepta' })
      .eq('concesion_id', 901)
    expect(error).not.toBeNull()
  })

  it('permiso por espacio', async () => {
    await admin()
      .from('permisos_extra')
      .insert({ perfil_id: anaId, espacio: 'TMICC' })
    const ana = await clienteComo('ana@pro.agency')
    const { error } = await ana
      .from('seguimiento')
      .update({ estado: 'acepta' })
      .eq('concesion_id', 901)
    expect(error).toBeNull()
  })

  it('kam no toca usos ni gsv', async () => {
    const ana = await clienteComo('ana@pro.agency')
    const { error } = await ana
      .from('seguimiento')
      .update({ usos: 5 })
      .eq('concesion_id', 900)
    expect(error?.message).toBe('Usos y GSV solo los modifica administración')
  })

  it('activa directa no rellena aceptación', async () => {
    const ana = await clienteComo('ana@pro.agency')
    const { error } = await ana
      .from('seguimiento')
      .update({ estado: 'activa' })
      .eq('concesion_id', 900)
    expect(error).toBeNull()
    const { data } = await admin()
      .from('seguimiento')
      .select('fecha_activacion, fecha_aceptacion')
      .eq('concesion_id', 900)
      .single()
    expect(data?.fecha_activacion).not.toBeNull()
    expect(data?.fecha_aceptacion).toBeNull()
  })

  it('promoción cerrada bloquea al kam', async () => {
    await admin().from('promociones').update({ estado: 'cerrada' }).eq('id', promo)
    const ana = await clienteComo('ana@pro.agency')
    const r1 = await ana
      .from('seguimiento')
      .update({ estado: 'acepta' })
      .eq('concesion_id', 900)
    expect(r1.error?.message).toContain('Sin permiso')
    const adm = await clienteComo('adm@pro.agency')
    const r2 = await adm
      .from('seguimiento')
      .update({ estado: 'acepta' })
      .eq('concesion_id', 900)
    expect(r2.error).toBeNull()
  })

  it('kam no ve borradores', async () => {
    await admin()
      .from('promociones')
      .insert({ tag: 'BORR', espacio: 'UFS', marca: 'UFS', estado: 'borrador' })
    const ana = await clienteComo('ana@pro.agency')
    const { data } = await ana.from('promociones').select('id').eq('tag', 'BORR')
    expect(data).toEqual([])
  })

  it('tag se normaliza', async () => {
    const { data, error } = await admin()
      .from('promociones')
      .insert({ tag: ' abc1 ', espacio: 'UFS', marca: 'UFS' })
      .select('tag')
      .single()
    expect(error).toBeNull()
    expect(data?.tag).toBe('ABC1')
  })

  it('no se convoca concesión inactiva', async () => {
    const a = admin()
    await a
      .from('concesiones')
      .insert({ id: 902, razon_social: 'C902', activa: false })
    const { error } = await a
      .from('seguimiento')
      .insert({ promocion_id: promo, concesion_id: 902 })
    expect(error).not.toBeNull()
  })
})
