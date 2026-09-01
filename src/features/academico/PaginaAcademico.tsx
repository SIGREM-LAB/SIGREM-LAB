import { CuerpoPagina, EncabezadoPagina } from '@/app/EncabezadoPagina'

export function PaginaAcademico() {
  return (
    <>
      <EncabezadoPagina
        titulo="Plan académico"
        descripcion="Programas, asignaturas y prácticas del plan de estudios"
      />
      <CuerpoPagina>{null}</CuerpoPagina>
    </>
  )
}
