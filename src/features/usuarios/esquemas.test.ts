import { describe, expect, test } from 'vitest'

import { almacenDe } from './esquemas'

describe('almacenDe', () => {
  test('un responsable guarda el almacén que eligió', () => {
    expect(almacenDe({ rol: 'responsable', almacenId: '3' })).toBe(3)
  })

  test('sin almacén elegido no inventa uno', () => {
    expect(almacenDe({ rol: 'responsable', almacenId: '' })).toBeNull()
  })

  /**
   * El caso que motiva la función: el campo se esconde al cambiar de rol, pero
   * react-hook-form conserva lo que ya se había elegido. Mandar ese resto
   * chocaría contra `perfil_almacen_solo_responsable`.
   */
  test('un admin no arrastra el almacén que se eligió antes de cambiar de rol', () => {
    expect(almacenDe({ rol: 'admin', almacenId: '3' })).toBeNull()
  })

  test('un usuario de consulta tampoco', () => {
    expect(almacenDe({ rol: 'consulta', almacenId: '3' })).toBeNull()
  })
})
