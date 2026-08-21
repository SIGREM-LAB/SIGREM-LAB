"""Conexión, la identidad que firma la carga, y los catálogos de la base.

Se conecta como `postgres`, no con la anon key: una carga administrativa se
salta la RLS por construcción —ese rol tiene `bypassrls`— y hace falta
transacción multi-sentencia, que PostgREST no da.
"""

from __future__ import annotations

import os
import uuid

import psycopg

from etl.rules.normalizar import clave
from etl.rules.validar import Catalogos

CORREO_DE_CARGA = "carga@uaeh.local"

# Lo que imprime `supabase start`.
DSN_LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


class FaltaPerfilDeCarga(Exception):
    pass


def dsn(explicito: str | None = None) -> str:
    return explicito or os.environ.get("DATABASE_URL") or DSN_LOCAL


def conectar(cadena: str) -> psycopg.Connection:
    return psycopg.connect(cadena, connect_timeout=30)


def perfil_de_carga(cur) -> uuid.UUID:
    cur.execute(
        """
        select p.id from public.perfil p
          join auth.users u on u.id = p.id
         where u.email = %s
        """,
        (CORREO_DE_CARGA,))
    fila = cur.fetchone()
    if fila is None:
        raise FaltaPerfilDeCarga(
            f"No existe el perfil {CORREO_DE_CARGA}. En local sale de "
            f"supabase/seed.sql (corre `supabase db reset`); en remoto se da de "
            f"alta desde el dashboard de Auth. Sin él, movimiento.usuario_id es "
            f"not null y ningún movimiento se puede insertar.")
    return fila[0]


def almacenes(cur) -> dict[str, int]:
    cur.execute("select clave, id from public.almacen")
    return dict(cur.fetchall())


def laboratorios(cur) -> dict[tuple[str, str], int]:
    """(clave de almacén, nombre normalizado) -> id."""
    cur.execute(
        """
        select a.clave, l.nombre, l.id
          from public.laboratorio l
          join public.almacen a on a.id = l.almacen_id
        """)
    return {(c, clave(nombre)): ident for c, nombre, ident in cur.fetchall()}


def catalogos(cur) -> Catalogos:
    labs: dict[str, set[str]] = {}
    for almacen, nombre in laboratorios(cur):
        labs.setdefault(almacen, set()).add(nombre)
    return Catalogos(laboratorios=labs)
