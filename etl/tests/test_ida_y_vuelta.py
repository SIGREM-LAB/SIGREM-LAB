"""El exportador produce lo que el ETL sabe leer.

Es lo unico que convierte «igual al formato que el personal conoce» en algo
comprobable en vez de una afirmacion. Decision D10 del spec del 21 de
septiembre de 2026.

El libro lo escribe `src/features/reportes/formatoUnificado.test.ts`, que corre
con `pnpm test`. No se versiona a proposito: un fixture commiteado seguiria
pasando el dia que alguien rompa el exportador, que es justo lo contrario de lo
que se busca aqui.

    pnpm test && pytest etl/tests/test_ida_y_vuelta.py
"""
from __future__ import annotations

from pathlib import Path

import pytest

from etl.extract.formato import CAMPOS, leer_libro

LIBRO = Path(__file__).parent / "fixtures" / "N3-formato.xlsx"


@pytest.fixture(scope="module")
def hojas():
    if not LIBRO.exists():
        pytest.skip(f"Falta {LIBRO}. Genera el libro con `pnpm test` antes.")
    return leer_libro(LIBRO, almacen="N3")


def test_el_etl_abre_lo_que_exporto_la_app(hojas):
    """Si esto falla, el exportador dejo de producir el formato unificado."""
    assert hojas, "leer_libro no encontro ninguna hoja de datos"
    assert [h.nombre for h in hojas] == ["Reactivos"]


def test_el_preambulo_llega_donde_el_etl_lo_busca(hojas):
    """F4, B5 y F5. Sin esto el archivo no dice de quien ni de cuando es."""
    hoja = hojas[0]

    assert hoja.responsable == "Responsable de prueba"
    assert hoja.periodo == "J-D 2026"
    assert hoja.actualizado == "2026-09-21"


def test_cada_campo_cae_en_su_columna(hojas):
    """La prueba que justifica todo el arreglo.

    Reactivos arranca en la B, salta la O y termina en la AB. Escribir las
    columnas seguidas desde la A produce un archivo que SE VE BIEN y del que el
    ETL no saca un solo campo.
    """
    primero = hojas[0].renglones[0]

    assert primero["sustancia"] == "Sustancia de prueba, líquido, presentación 1 L"
    assert primero["sub_ubicacion"] == "N3"
    assert primero["marca"] == "MARCA-PRUEBA"
    assert primero["observaciones"] == "Renglón sintético"


def test_los_numeros_siguen_siendo_numeros(hojas):
    """Los Excel originales traian «Un frasco» en columna numerica.

    El exportador no puede reintroducir por la puerta de salida lo que el ETL
    limpio en la de entrada.
    """
    primero = hojas[0].renglones[0]

    assert primero["cantidad"] == 248.54
    assert primero["peso_vacio"] == 40
    assert isinstance(primero["cantidad"], (int, float))


def test_ninguna_llave_le_es_desconocida_al_etl(hojas):
    """Una llave que CAMPOS no conoce es una columna desalineada."""
    for hoja in hojas:
        conocidas = set(CAMPOS[hoja.nombre])
        for renglon in hoja.renglones:
            sobran = set(renglon) - conocidas
            assert not sobran, f"{hoja.nombre}: llaves que el ETL no reconoce: {sobran}"


def test_los_renglones_a_medias_tambien_entran(hojas):
    """El segundo renglon del libro deja columnas vacias a proposito.

    Un almacen real no llena todas: lo que no esta no debe tumbar la lectura ni
    desplazar lo que viene detras.
    """
    assert len(hojas[0].renglones) == 2

    segundo = hojas[0].renglones[1]
    assert segundo["sustancia"] == "Segunda sustancia de prueba, sólido"
    assert segundo["cantidad"] == 10
    assert "marca" not in segundo or segundo["marca"] in (None, "")
