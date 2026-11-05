"""Series e inventarios que Excel guardó como número."""

from __future__ import annotations

import pytest

from etl.rules.normalizar import identificador, numero_inventario


@pytest.mark.parametrize("celda, esperado", [
    (8000.0, "8000"),
    (75010083922.0, "75010083922"),
    ("10-1125", "10-1125"),
    ("B610196949", "B610196949"),
    ("Sin serie", None),
    (None, None),
])
def test_la_serie_no_gana_un_punto_cero(celda, esperado):
    assert identificador(celda).dato == esperado


def test_el_inventario_numerico_sigue_quitando_ceros():
    assert numero_inventario(5311305089.0).dato == "5311305089"
    assert numero_inventario("05311305089").dato == "5311305089"
