"""Funciones puras que convierten una celda del Excel en un valor del esquema.

Cada una devuelve un `Valor` —con un aviso si tuvo que corregir algo— o lanza
`Rechazo` si el dato no se puede salvar sin adivinar. Ninguna toca la base ni
sabe de qué hoja viene la celda: por eso se prueban en milisegundos.
"""

from __future__ import annotations

import difflib
import re
import unicodedata
from dataclasses import dataclass
from typing import Any

# Contrato ETL §3. Todas se leen como NULL, que es lo que hace funcionar a los
# índices únicos parciales de serie y de inventario: hacen falta tantos NULL
# como equipos sin identificar haya.
#
# La partición importa. La regla 6 pide que para decir «no tiene» se use UNA
# sola forma: las acordadas por el formato pasan calladas, y las demás se
# aceptan pero se anotan, para que el almacén corrija su archivo.
FORMAS_ACORDADAS = frozenset({"", "-", "—", "sin serie", "sin modelo",
                              "sin inventario", "sin marca"})
FORMAS_TOLERADAS = frozenset({"s/n", "n/a", "na", "s/d", "nd", "sin dato",
                              "no aplica", "ninguno", "ninguna"})
VACIOS = FORMAS_ACORDADAS | FORMAS_TOLERADAS

# Regla 2: la cantidad va en la unidad más pequeña que se consume; el empaque
# va en Presentación. El desplegable del formato ofrece varias de estas, así
# que el error no es del capturista: es una trampa del propio formato.
UNIDADES_DE_EMPAQUE = frozenset({
    "caja", "cajas", "paquete", "paquetes", "kit", "kits", "bolsa", "bolsas",
    "rollo", "rollos", "carrete", "carretes", "frasco", "frascos", "bote",
    "botes", "bidon", "bidones", "garrafa", "garrafas", "garrafon",
    "garrafones", "tubo", "tubos", "lata", "latas", "sobre", "sobres",
})

# Regla 5: la ubicación va en columnas separadas. Este vocabulario existe para
# atrapar erratas invisibles —«Respisa» por «Repisa»— comparando contra
# palabras conocidas. Lo que no se parece a nada de aquí pasa sin quejas: no se
# puede juzgar un mueble que nadie ha visto.
MUEBLES = frozenset({
    "anaquel", "gabinete", "gaveta", "repisa", "separador", "credenza",
    "mesa", "refrigerador", "congelador", "bidones", "campana", "husky",
    "tarja", "pasillo", "area", "sala", "barra", "cuarto", "bajo", "estante",
    "vitrina", "armario", "closet", "mueble", "cajon", "vitrina", "banco",
})

# «Gaveta7»: palabra pegada a su número.
MUEBLE_PEGADO = re.compile(r"^([^\W\d_]+)(\d+)$", re.UNICODE)

GRADOS = {"grado 0": 0, "grado 1": 1, "grado 2": 2, "grado 3": 3, "grado 4": 4}

COLORES = frozenset({"verde", "rojo", "azul", "blanco", "amarillo", "naranja"})
# Regla 12: «NO TÓXICO» no es un color. 143 renglones de N3 lo dicen.
SINONIMOS_COLOR = {"no toxico": "verde"}

FUNCIONAMIENTO = {"correcto": "correcto", "presenta fallas": "presenta_fallas"}

R_NUMERO = "Regla 1 · en una columna de números va solo el número"
R_EMPAQUE = "Regla 2 · la cantidad va en la unidad más pequeña que se consume"
R_ESPACIOS = "Regla 3 · sin espacios de sobra ni dobles"
R_MARCA = "Regla 4 · cada nombre se escribe siempre igual"
R_UBICACION = "Regla 5 · la ubicación va en columnas separadas"
R_AUSENCIA = "Regla 6 · para decir «no tiene» se usa una sola forma"
R_VACIO_CERO = "Regla 6 · celda vacía significa cero"
R_INVENTARIO = "Regla 10 · el número de inventario no se repite entre renglones"
R_ESTADO = "Regla 11 · un solo estado físico por reactivo"
R_COLOR = "Regla 12 · los colores de almacenaje son seis"
R_NFPA = "NFPA · el grado va del 0 al 4"
R_SI_NO = "Sí/No · la columna solo admite esas dos respuestas"
R_ENUM_FUNC = "Choque con el esquema · enum funcionamiento_equipo"


class Rechazo(Exception):
    def __init__(self, regla: str, detalle: str) -> None:
        super().__init__(detalle)
        self.regla = regla
        self.detalle = detalle


@dataclass(frozen=True)
class Valor:
    dato: Any
    aviso: str | None = None
    # Qué regla justifica el aviso. Sin esto, quien anota en el informe tendría
    # que adivinarla del texto del aviso, y la prueba de aceptación compara
    # justamente contra la regla que DEFECTOS.md declara.
    regla: str = ""


def clave(v: Any) -> str:
    """Minúsculas, sin acentos y sin espacios de sobra: lo que hace norm_texto().

    Es la única forma de que «Caracterización y procesamiento» del Excel case
    con «Caracterizacion y procesamiento», que es como está en la base.
    """
    d = unicodedata.normalize("NFD", str(v).lower())
    sin = "".join(c for c in d if unicodedata.category(c) != "Mn")
    return " ".join(sin.split())


def texto(v: Any) -> Valor:
    """Regla 3 y contrato §3: trim, colapso de dobles, y las formas de ausencia."""
    if v is None:
        return Valor(None)
    crudo = str(v)
    limpio = " ".join(crudo.split())
    c = clave(limpio)
    if c in FORMAS_TOLERADAS:
        return Valor(None, f"«{limpio}» se lee como sin dato; la forma acordada "
                           f"es «Sin serie» o «Sin inventario»", R_AUSENCIA)
    if c in FORMAS_ACORDADAS:
        return Valor(None)
    if limpio != crudo:
        return Valor(limpio, f"«{crudo}» tenía espacios sobrantes", R_ESPACIOS)
    return Valor(limpio)


def unidad(v: Any) -> Valor:
    """Regla 2: un empaque no es una unidad de consumo.

    «4 bolsas» de LED no dice nada si no se sabe de cuántos era cada bolsa, y
    convertirlo a la callada sería inventar el dato.
    """
    t = texto(v)
    if t.dato is None:
        return t
    if clave(t.dato) in UNIDADES_DE_EMPAQUE:
        raise Rechazo(R_EMPAQUE,
                      f"«{t.dato}» es un empaque, no una unidad de consumo; "
                      f"va en Presentación")
    return t


def mueble(v: Any) -> Valor:
    """Regla 5: «Gaveta7» se separa; «Respisa» se rechaza como errata."""
    t = texto(v)
    if t.dato is None:
        return t

    pegado = MUEBLE_PEGADO.match(t.dato)
    if pegado and clave(pegado.group(1)) in MUEBLES:
        arreglado = f"{pegado.group(1)} {pegado.group(2)}"
        return Valor(arreglado,
                     f"«{t.dato}» iba pegado; se lee «{arreglado}»", R_UBICACION)

    primera = clave(t.dato).split()[0] if t.dato.split() else ""
    if primera and primera not in MUEBLES:
        cercana = difflib.get_close_matches(primera, MUEBLES, n=1, cutoff=0.8)
        if cercana:
            raise Rechazo(R_UBICACION,
                          f"«{t.dato}»: ¿quiso decir «{cercana[0]}»?")
    return t


def numero(v: Any, regla: str = R_NUMERO) -> Valor:
    """Regla 6: celda vacía significa cero."""
    if isinstance(v, bool):
        raise Rechazo(regla, f"«{v}» no es un número")
    if isinstance(v, (int, float)):
        return Valor(v)
    if v is None or clave(v) in VACIOS:
        return Valor(0, "celda vacía se lee como cero", R_VACIO_CERO)
    raise Rechazo(regla, f"«{' '.join(str(v).split())}» no es un número")


def numero_opcional(v: Any, regla: str = R_NUMERO) -> Valor:
    """Como numero(), pero el vacío es NULL y no cero.

    Para los pesos: N4 los deja vacíos porque captura la cantidad directa, y un
    cero ahí significaría que el frasco vacío pesa 0 g.
    """
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return Valor(v)
    if v is None or clave(v) in VACIOS:
        return Valor(None)
    raise Rechazo(regla, f"«{' '.join(str(v).split())}» no es un número")


def numero_inventario(v: Any) -> Valor:
    """Regla 10: 5311300206 y 05311300206 son el mismo número.

    Normalizar ANTES de validar es lo que permite que la regla 10 vea el
    duplicado. Al revés, los dos entrarían y el índice único no los atraparía.
    """
    t = texto(v)
    if t.dato is None or not t.dato.isdigit():
        return t
    sin_ceros = t.dato.lstrip("0") or "0"
    if sin_ceros != t.dato:
        return Valor(sin_ceros, f"«{t.dato}» llevaba ceros a la izquierda",
                     R_INVENTARIO)
    return t


def grado_nfpa(v: Any) -> Valor:
    """«Grado 2: Riesgo moderado» → 2."""
    if v is None:
        return Valor(None)
    c = clave(v).split(":")[0].strip()
    if c in GRADOS:
        return Valor(GRADOS[c])
    raise Rechazo(R_NFPA, f"«{v}» no es un grado NFPA del 0 al 4")


def color(v: Any) -> Valor:
    c = clave(v) if v is not None else ""
    if c in COLORES:
        return Valor(c)
    if c in SINONIMOS_COLOR:
        destino = SINONIMOS_COLOR[c]
        return Valor(destino, f"«{v}» no es un color; se lee como {destino}",
                     R_COLOR)
    if not c:
        raise Rechazo(R_COLOR, "sin color de almacenaje")
    raise Rechazo(R_COLOR, f"«{v}» no es uno de los seis colores")


def si_no(v: Any) -> Valor:
    if v is None:
        return Valor(None)
    c = clave(v)
    if c in ("si", "s", "true", "1"):
        return Valor(True)
    if c in ("no", "n", "false", "0"):
        return Valor(False)
    raise Rechazo(R_SI_NO, f"«{v}» no es Sí ni No")


def estado_fisico(solido: Any, liquido: Any, gas: Any) -> Valor:
    """Regla 11: de las tres casillas se marca exactamente una."""
    marcadas = [nombre for nombre, casilla in
                (("solido", solido), ("liquido", liquido), ("gas", gas))
                if casilla is not None and clave(casilla) == "x"]
    if len(marcadas) == 1:
        return Valor(marcadas[0])
    if not marcadas:
        raise Rechazo(R_ESTADO, "ninguna casilla de estado físico marcada")
    raise Rechazo(R_ESTADO,
                  f"{len(marcadas)} casillas marcadas: {', '.join(marcadas)}")


def funcionamiento(v: Any) -> Valor:
    c = clave(v) if v is not None else ""
    if c in FUNCIONAMIENTO:
        return Valor(FUNCIONAMIENTO[c])
    raise Rechazo(
        R_ENUM_FUNC,
        f"«{v}» no está en el enum funcionamiento_equipo: solo Correcto y "
        f"Presenta fallas")
