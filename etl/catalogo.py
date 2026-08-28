"""Resolver un artículo, o crearlo.

SOLO por coincidencia exacta: primero la identidad
`(nombre_canonico, descripcion, unidad_base)`, que es la llave única de la
tabla; después `articulo_alias.texto` exacto.

`buscar_articulo()` se llama, pero para AVISAR, no para decidir. Compara por
trigramas, y estas dos cadenas tienen similitud altísima:

    Zinc en polvo, sólido, pureza 95%, presentación 500 g, CAS: 7440-66-6
    Zinc en polvo, sólido, pureza 93%, presentación 500 g, CAS: 7440-66-6

y son DOS artículos: la pureza cambia la sustancia. Auto-aceptar la mejor
coincidencia difusa los fusionaría en silencio, con las cantidades sumadas, y
eso no lanza ningún error ni se ve en ninguna pantalla. Fusionar es una decisión
humana, y el esquema le dio función propia: `public.fusionar_articulo()`.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Resolucion:
    articulo_id: int
    creado: bool
    parecidos: list[tuple[int, str, float]] = field(default_factory=list)


def _por_identidad(cur, nombre: str, descripcion: str | None,
                   unidad: str) -> int | None:
    cur.execute(
        """
        select id from public.articulo
         where nombre_canonico is not distinct from %s
           and descripcion     is not distinct from %s
           and unidad_base     is not distinct from %s
        """,
        (nombre, descripcion, unidad))
    fila = cur.fetchone()
    return fila[0] if fila else None


def _por_alias(cur, texto: str, descripcion: str | None,
               unidad: str) -> int | None:
    """Un alias solo vale si NO contradice la identidad del renglón.

    El nombre crudo se guarda como alias, y en las hojas con columna de
    Especificación el nombre por sí solo es ambiguo por construcción:
    «Matraz volumétrico» es el de 1000 mL y también el de 250 mL. Sin
    comprobar descripción y unidad, el segundo resolvía al primero y los dos
    artículos se fusionaban en silencio, que es exactamente lo que este
    cargador existe para no hacer.
    """
    cur.execute(
        """
        select al.articulo_id
          from public.articulo_alias al
          join public.articulo a on a.id = al.articulo_id
         where al.texto = %s
           and a.descripcion is not distinct from %s
           and a.unidad_base is not distinct from %s
         limit 1
        """,
        (texto, descripcion, unidad))
    fila = cur.fetchone()
    return fila[0] if fila else None


def _parecidos(cur, nombre: str) -> list[tuple[int, str, float]]:
    cur.execute(
        "select articulo_id, nombre_canonico, similitud "
        "  from public.buscar_articulo(%s, 0.4, 5)", (nombre,))
    return list(cur.fetchall())


def _guardar_alias(cur, articulo_id: int, texto: str) -> None:
    cur.execute(
        "insert into public.articulo_alias (articulo_id, texto, origen) "
        "values (%s, %s, 'migracion') on conflict (articulo_id, texto) do nothing",
        (articulo_id, texto))


def resolver(cur, *, nombre: str, descripcion: str | None, unidad: str,
             clasificacion: str, familia: str | None = None,
             perfil_id: uuid.UUID) -> Resolucion:
    existente = _por_identidad(cur, nombre, descripcion, unidad)
    if existente is None:
        existente = _por_alias(cur, nombre, descripcion, unidad)

    if existente is not None:
        _guardar_alias(cur, existente, nombre)
        return Resolucion(articulo_id=existente, creado=False)

    parecidos = _parecidos(cur, nombre)

    cur.execute(
        """
        insert into public.articulo
          (nombre_canonico, descripcion, clasificacion, unidad_base, familia,
           verificado, creado_por)
        values (%s, %s, %s, %s, %s, false, %s)
        returning id
        """,
        (nombre, descripcion, clasificacion, unidad, familia, perfil_id))
    nuevo = cur.fetchone()[0]
    _guardar_alias(cur, nuevo, nombre)
    return Resolucion(articulo_id=nuevo, creado=True, parecidos=parecidos)
