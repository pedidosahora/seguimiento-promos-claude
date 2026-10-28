import { beforeEach, describe, expect, it } from 'vitest'
import { admin, clienteComo, crearUsuario, resetDatos } from './ayuda'

let ids: Record<number, string>

async function escenario() {
  await resetDatos()
  const a = admin()
  await crearUsuario({ email: 'adm@pro.agency', nombre: 'Adm', rol: 'admin' })
  const anaId = (await crearUsuario({ email: 'ana@pro.agency', nombre: 'Ana', rol: 'kam' })).perfilId
  await a.from('concesiones').insert([
    { id: 900, razon_social: 'C900', kam_id: anaId },
    { id: 901, razon_social: 'C901', kam_id: anaId },
  ])
  const { data: p, error } = await a
    .from('promociones')
    .insert({
      tag: 'T1', espacio: 'TMICC', marca: 'TMICC', mecanica: 'm',
      fecha_inicio: '2026-01-01', fecha_fin: '2026-02-01', estado: 'publicada',
    })
    .select('id')
    .single()
  if (error) throw error
  const { data: s, error: e2 } = await a
    .from('seguimiento')
    .insert([
      { promocion_id: p.id, concesion_id: 900 },
      { promocion_id: p.id, concesion_id: 901 },
    ])
    .select('id, concesion_id')
  if (e2) throw e2
  ids = Object.fromEntries(s.map((f) => [f.concesion_id, f.id]))
}

const cuantas = async () =>
  (await admin().from('seguimiento').select('id', { count: 'exact', head: true })).count

describe('desconvocar', () => {
  beforeEach(escenario)

  it('borra una fila sin tocar', async () => {
    const adm = await clienteComo('adm@pro.agency')
    const { data, error } = await adm.rpc('desconvocar', { p_ids: [ids[900]] })
    expect(error).toBeNull()
    expect(data).toBe(1)
    expect(await cuantas()).toBe(1)
  })

  it('con un comentario falla y no borra nada', async () => {
    const a = admin()
    const { data: perfil } = await a.from('perfiles').select('id').eq('email', 'ana@pro.agency').single()
    await a.from('comentarios').insert({ seguimiento_id: ids[901], texto: 'hola', autor_id: perfil!.id })
    const adm = await clienteComo('adm@pro.agency')
    const { error } = await adm.rpc('desconvocar', { p_ids: [ids[900], ids[901]] })
    expect(error?.message).toContain('márcala como "No entra"')
    expect(await cuantas()).toBe(2)
  })

  it('con el estado cambiado falla y no borra nada', async () => {
    const adm = await clienteComo('adm@pro.agency')
    const { error: eu } = await adm.from('seguimiento').update({ estado: 'acepta' }).eq('id', ids[901])
    expect(eu).toBeNull()
    const { error } = await adm.rpc('desconvocar', { p_ids: [ids[900], ids[901]] })
    expect(error?.message).toContain('márcala como "No entra"')
    expect(await cuantas()).toBe(2)
  })

  it('un kam recibe error', async () => {
    const ana = await clienteComo('ana@pro.agency')
    const { error } = await ana.rpc('desconvocar', { p_ids: [ids[900]] })
    expect(error).not.toBeNull()
    expect(await cuantas()).toBe(2)
  })
})
