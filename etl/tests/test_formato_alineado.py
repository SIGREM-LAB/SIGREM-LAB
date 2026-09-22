"""Las dos definiciones del formato dicen lo mismo.

El formato unificado esta descrito DOS veces a proposito (decision D10 del spec
del 21 de septiembre de 2026):

    etl/extract/formato.py   CAMPOS, HOJAS_DE_DATOS, FILA_ENCABEZADO
    la base                  columna_formato, hoja_formato

No se unifican porque el ETL funciona, esta probado contra archivos reales de
seis almacenes, y atarlo a tener conexion para poder leer un archivo seria un
retroceso. Lo que impide que se separen no es la disciplina: es esta prueba.

Y no es hipotetico. El 21 de septiembre se descubrio que `HOJAS_DE_DATOS`
buscaba «Materia biologica» mientras los libros traen «Material biologico», y
que por eso el mapeo de esa hoja llevaba meses desfasado una columna sin que
nadie lo notara. Dos fallos silenciosos tapandose el uno al otro.

Necesita conexion. Se salta sin ella:

    DATABASE_URL=postgresql://... pytest etl/tests/test_formato_alineado.py
"""
from __future__ import annotations

import os

import pytest

from etl.extract.formato import (
    CAMPOS,
    FILA_ENCABEZADO,
    FILA_ENCABEZADO_DEFECTO,
    HOJAS_DE_DATOS,
)

psycopg = pytest.importorskip("psycopg")


@pytest.fixture(scope="module")
def base():
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        pytest.skip("Sin DATABASE_URL: esta prueba necesita hablar con la base.")

    try:
        con = psycopg.connect(dsn, connect_timeout=15)
    except Exception as e:  # noqa: BLE001 - cualquier fallo de red es un skip
        pytest.skip(f"No se pudo conectar: {e}")

    with con:
        yield con


def consulta(con, sql):
    with con.cursor() as cur:
        cur.execute(sql)
        return cur.fetchall()


def test_las_mismas_seis_hojas(base):
    de_la_base = {h for (h,) in consulta(base, "select hoja from public.hoja_formato")}

    assert de_la_base == set(HOJAS_DE_DATOS)


def test_el_orden_de_las_hojas_coincide(base):
    """El orden decide que renglon crea el articulo y cual lo reutiliza.

    `articulo` es global, asi que una carga con las hojas en otro orden no es
    reproducible. Por eso el orden es dato, no casualidad.
    """
    de_la_base = [
        h for (h,) in consulta(base, "select hoja from public.hoja_formato order by orden")
    ]

    assert de_la_base == list(HOJAS_DE_DATOS)


def test_cada_campo_en_la_misma_letra(base):
    """El corazon de la prueba: campo por campo, letra por letra."""
    filas = consulta(base, "select hoja, campo, columna from public.columna_formato")
    de_la_base: dict[str, dict[str, str]] = {}
    for hoja, campo, columna in filas:
        de_la_base.setdefault(hoja, {})[campo] = columna

    for hoja in HOJAS_DE_DATOS:
        assert hoja in de_la_base, f"La base no describe la hoja {hoja}"
        assert de_la_base[hoja] == CAMPOS[hoja], (
            f"{hoja}: el ETL y la base no mapean las mismas columnas.\n"
            f"  ETL:  {CAMPOS[hoja]}\n"
            f"  base: {de_la_base[hoja]}"
        )


def test_la_fila_del_encabezado_coincide(base):
    """Reactivos en la 9 por las tres filas agrupadas de la NOM; el resto en 8."""
    filas = consulta(base, "select hoja, fila_encabezado from public.hoja_formato")

    for hoja, fila in filas:
        esperada = FILA_ENCABEZADO.get(hoja, FILA_ENCABEZADO_DEFECTO)
        assert fila == esperada, f"{hoja}: la base dice fila {fila}, el ETL {esperada}"


def test_el_preambulo_esta_donde_el_etl_lo_lee(base):
    """`_hoja` lee F4, B5 y F5. Si la base dice otras celdas, el exportador
    escribiria el responsable donde nadie lo busca."""
    filas = consulta(
        base,
        "select hoja, celda_responsable, celda_periodo, celda_actualizado"
        "  from public.hoja_formato",
    )

    for hoja, responsable, periodo, actualizado in filas:
        assert (responsable, periodo, actualizado) == ("F4", "B5", "F5"), hoja
