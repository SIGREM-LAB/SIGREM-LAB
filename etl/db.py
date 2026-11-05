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

# Quien firma la carga. En local sale de seed.sql; en remoto NO existe, porque
# datos-iniciales.sql excluye a proposito los usuarios de prueba —meter en
# produccion seis cuentas con la contrasenia escrita en el repositorio seria
# abrir seis puertas con llave conocida—. Alla se da de alta un usuario de
# servicio propio desde el dashboard de Auth y se apunta aqui con la variable.
CORREO_DE_CARGA = os.environ.get("ETL_CORREO_CARGA", "carga@uaeh.local")

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


# La base nombra los almacenes con la clave institucional («UCL-LUM»); los
# libros, sus carpetas y sus sub-ubicaciones, con la corta («LUM», «LUM-2»). El
# ETL trabaja con la corta y traduce aquí, al leer la base, para que la
# comparación de sub-ubicaciones siga hablando el idioma del Excel. La base
# local (supabase/seed.sql) todavía usa la corta y pasa sin cambio.
PREFIJO_INSTITUCIONAL = "UCL-"


def clave_de_libro(clave_en_base: str) -> str:
    return clave_en_base.removeprefix(PREFIJO_INSTITUCIONAL)


def almacenes(cur) -> dict[str, int]:
    """Clave corta -> id. Truena si dos almacenes de la base caen en la misma."""
    cur.execute("select clave, id from public.almacen")
    salida: dict[str, int] = {}
    for clave_base, ident in cur.fetchall():
        corta = clave_de_libro(clave_base)
        if corta in salida:
            raise ValueError(
                f"Dos almacenes de la base se leen como «{corta}». Renombra uno "
                f"antes de cargar: el ETL no puede decidir a cuál va el libro.")
        salida[corta] = ident
    return salida


def laboratorios(cur) -> dict[tuple[str, str], int]:
    """(clave corta de almacén, nombre normalizado) -> id."""
    cur.execute(
        """
        select a.clave, l.nombre, l.id
          from public.laboratorio l
          join public.almacen a on a.id = l.almacen_id
        """)
    return {(clave_de_libro(c), clave(nombre)): ident
            for c, nombre, ident in cur.fetchall()}


def catalogos(cur) -> Catalogos:
    labs: dict[str, set[str]] = {}
    for almacen, nombre in laboratorios(cur):
        labs.setdefault(almacen, set()).add(nombre)
    return Catalogos(laboratorios=labs)
