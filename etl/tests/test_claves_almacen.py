"""La clave institucional de la base contra la corta de los libros.

En el remoto LUM se llama «UCL-LUM»; en el Excel, en su carpeta y en sus
sub-ubicaciones («LUM-2») sigue siendo «LUM». Sin la traducción, el cargador
no encuentra el almacén y no carga nada.
"""

from __future__ import annotations

import pytest

from etl import db


class Cursor:
    """Lo mínimo de un cursor de psycopg: devuelve las filas que se le den."""

    def __init__(self, filas):
        self.filas = filas

    def execute(self, *_):
        pass

    def fetchall(self):
        return self.filas


def test_la_clave_institucional_se_lee_como_la_del_libro():
    assert db.almacenes(Cursor([("UCL-LUM", 3), ("UCL-N3", 1)])) == {"LUM": 3, "N3": 1}


def test_la_clave_corta_de_la_base_local_pasa_igual():
    assert db.almacenes(Cursor([("LUM", 3), ("ICSA", 7)])) == {"LUM": 3, "ICSA": 7}


def test_dos_almacenes_con_la_misma_clave_corta_detienen_la_carga():
    with pytest.raises(ValueError, match="«LUM»"):
        db.almacenes(Cursor([("LUM", 3), ("UCL-LUM", 9)]))


def test_los_laboratorios_quedan_bajo_la_clave_del_libro():
    labs = db.laboratorios(Cursor([("UCL-LUM", "Caracterización y procesamiento", 5)]))
    assert list(labs) == [("LUM", db.clave("Caracterización y procesamiento"))]
