"""Genera `corregido/` a partir de `original/`. El original NUNCA se toca.

    python -m etl.corregir              genera y verifica
    python -m etl.corregir --verificar  solo verifica lo ya generado

Aqui van SOLO las correcciones deterministas: las que tienen un destino unico
y comprobable sin preguntarle a nadie. Una errata cuyo arreglo dependa de saber
cuantas piezas trae una caja, o de si ese frasco se peso o se midio, no entra
aqui y no debe entrar nunca: eso lo resuelve la pantalla de depuracion
(`docs/plans/2026-08-26-pantalla-depuracion-inventario.md`).

Por que un script y no editar el Excel a mano: las correcciones viven aqui, no
en el binario. Cuando N3 mande su siguiente version se vuelve a correr y el
diff de `correcciones-aplicadas.csv` se lee. Editar el .xlsx a mano deja el
archivo cambiado y ninguna forma de saber que se cambio.
"""

from __future__ import annotations

import argparse
import csv
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

from openpyxl import load_workbook

from etl.extract.formato import CAMPOS, HOJAS_DE_DATOS

RAIZ = Path(__file__).resolve().parents[1]
DATOS = RAIZ / "etl" / "Datos-Reales-JD2026"
ORIGINAL = DATOS / "original"
CORREGIDO = DATOS / "corregido"

BITACORA = "correcciones-aplicadas.csv"
COLUMNAS = ("archivo", "hoja", "celda", "campo", "antes", "despues", "motivo")


@dataclass(frozen=True)
class Correccion:
    """Un reemplazo literal sobre un campo, opcionalmente acotado a unas filas.

    `filas` no es una optimizacion: es el cinturon de seguridad. Un
    `«portatil» -> «portátil»` suelto sobre toda la hoja podria pegarle a un
    renglon que todavia no he mirado. Acotado a la fila que revise, no.
    """

    hoja: str
    campo: str
    buscar: str
    poner: str
    motivo: str
    filas: tuple[int, ...] = ()
    # Cuantas celdas se espera cambiar. La verificacion falla si no cuadra:
    # que el archivo cambie y esto siga en silencio es justo lo que no quiero.
    esperadas: int | None = None
    # Subcadena de la ruta del libro al que aplica. Vacio = a todos.
    #
    # Sin esto, una correccion nacida de un almacen se aplica sobre el libro de
    # otro: `Gabienete -> Gabinete` existen en N3 y en Huejutla, pero el conteo
    # esperado es de N3, asi que el segundo libro tumbaria la corrida. Y al
    # reves: una errata de N3 corregida sobre Huejutla cambiaria datos que nadie
    # reviso.
    libro: str = ""


@dataclass(frozen=True)
class Numerico:
    """Una celda que trae un numero escrito como texto. Regla 1."""

    hoja: str
    campo: str
    fila: int
    motivo: str
    libro: str = ""


# ---------------------------------------------------------------------------
# Las correcciones de N3
# ---------------------------------------------------------------------------
# Cada bloque dice de donde salio. Sin eso, dentro de un mes nadie sabe si
# «geado -> grado» fue un hallazgo o un capricho.

# 1. Regla 5. El propio ETL nombra el destino: normalizar.mueble() rechaza
#    «Gabienete 301» con «¿quiso decir gabinete?». 74 renglones de Material.
MUEBLES = [
    Correccion("Material", "mueble", "Gabienete", "Gabinete",
               "Regla 5 · errata de mueble; el ETL propone el destino",
               esperadas=74, libro="Nivel-3"),
]

# 2. Regla 3 / identidad del articulo. Estos cinco pares son IDENTICOS al
#    quitar acentos, mayusculas, espacios y puntuacion, asi que unificarlos no
#    puede fusionar dos articulos distintos: es el unico caso en que unificar
#    es seguro. Sin esto, `catalogo.resolver()` crea dos articulos para una
#    sola cosa, porque compara por igualdad exacta.
#
#    Los tres primeros se doblan a la forma mayoritaria. Los dos de Material
#    estan 1-1, asi que ahi manda la ortografia: «termómetro» y «portátil».
PARTIDOS = [
    Correccion("Reactivos", "sustancia", "sólido,presentación", "sólido, presentación",
               "Identidad del articulo · falta un espacio; 2 renglones lo escriben bien",
               filas=(222,), esperadas=1, libro="Nivel-3"),
    Correccion("Reactivos", "sustancia", "sólido (anaerobios)", "sólido, (anaerobios)",
               "Identidad del articulo · se dobla a la forma mayoritaria (2 de 3)",
               filas=(371,), esperadas=1, libro="Nivel-3"),
    Correccion("Reactivos", "sustancia", "McCoy´s", "McCoy's",
               "Identidad del articulo · acento agudo usado como apostrofo (3 de 4)",
               filas=(784,), esperadas=1, libro="Nivel-3"),
    Correccion("Material", "articulo", "Termométro", "Termómetro",
               "Identidad del articulo · empate 1-1; manda la ortografia",
               filas=(233,), esperadas=1, libro="Nivel-3"),
    Correccion("Material", "articulo", "Potenciómetro portatil", "Potenciómetro portátil",
               "Identidad del articulo · empate 1-1; manda la ortografia",
               filas=(232,), esperadas=1, libro="Nivel-3"),
]

# 3. Erratas de palabra con destino unico. El criterio para que una entre aqui:
#    la palabra mal escrita aparece <=3 veces y la correcta cientos, asi que no
#    hay ambiguedad sobre que se quiso escribir.
#
#    NO estan aqui «piseta», «nitrito», «subnitrato», «anhídrido» ni
#    «tricloruro»: el barrido las marco por parecido, pero las cinco son
#    palabras reales y distintas de aquella a la que se parecen. Corregirlas
#    seria inventar.
ERRATAS = [
    Correccion("Reactivos", "sustancia", "geado", "grado",
               "Errata · «grado» aparece cientos de veces", filas=(323, 324, 325),
               esperadas=3, libro="Nivel-3"),
    Correccion("Reactivos", "sustancia", "purea", "pureza",
               "Errata · «pureza» x423", filas=(390, 440), esperadas=2, libro="Nivel-3"),
    Correccion("Reactivos", "sustancia", "puraza", "pureza",
               "Errata · «pureza» x423", filas=(485, 1040), esperadas=2, libro="Nivel-3"),
    Correccion("Reactivos", "sustancia", "sólio", "sólido",
               "Errata · «sólido» x791", filas=(769,), esperadas=1, libro="Nivel-3"),
    # Ergoesterol es ademas el caso de los 20 frascos: sin esta correccion se
    # queda como un articulo suelto al lado de los 23 «Ergosterol».
    Correccion("Reactivos", "sustancia", "Ergoesterol", "Ergosterol",
               "Errata · «Ergosterol» x23 en la misma hoja", filas=(610,),
               esperadas=1, libro="Nivel-3"),
]

# 4. Los siete deletreos de «presentación». Van aparte porque son la misma
#    palabra siete veces, no siete hallazgos distintos.
PRESENTACION = [
    Correccion("Reactivos", "sustancia", mal, "presentación",
               "Errata · «presentación» x1046", filas=(fila,), esperadas=1,
               libro="Nivel-3")
    for mal, fila in (
        ("resentación", 226),
        ("pesentación", 403),
        ("oresentación", 474),
        ("presentacio", 492),
        ("prensentación", 756),
        ("presentacón", 972),
        ("presentasión", 986),
        ("presentacio", 1035),
    )
]

# 5. Regla 4. `validar()` ya dobla «SIN MARCA» a «Sin marca» sola, pero gana la
#    PRIMERA forma que ve en la corrida, que depende del orden de los archivos.
#    Dejarlo escrito aqui hace que el resultado no dependa de ese orden.
MARCAS = [
    Correccion(hoja, "marca", "SIN MARCA", "Sin marca",
               "Regla 4 · una sola grafia por marca", libro="Nivel-3")
    for hoja in ("Reactivos", "Insumos", "Material")
]

# ---------------------------------------------------------------------------
# Las correcciones de Huejutla
# ---------------------------------------------------------------------------
# El libro de Huejutla se capturo sobre la plantilla de N3 y la columna
# Sub-ubicacion quedo en «N3» en las 440 filas. La regla de sub-ubicacion
# rechaza el renglon entero cuando no es del almacen, asi que sin esto no entra
# uno solo: los 440 se irian a carga_pendiente. El destino es unico —el
# responsable confirmo que el inventario es de Huejutla, no de N3— y el conteo
# por hoja va fijo para que un archivo distinto tumbe la corrida.
SUB_UBICACION_HUJ = [
    Correccion(hoja, "sub_ubicacion", "N3", "HUJ",
               "Archivo mal rotulado · el libro es de Huejutla, no de N3",
               libro="Huejutla", esperadas=n)
    for hoja, n in (("Reactivos", 111), ("Insumos", 82), ("Material", 247))
]

# Las mismas dos que en N3, pero acotadas a este libro. El archivo de Huejutla
# se capturo sobre la plantilla de N3, asi que arrastra la misma errata de
# mueble y el mismo 0.5 guardado como texto. El destino es unico y el conteo va
# fijo: 23+13+13+13+12 = 74 «Gabienete».
MUEBLES_HUJ = [
    Correccion("Material", "mueble", "Gabienete", "Gabinete",
               "Regla 5 · errata de mueble; el ETL propone el destino",
               esperadas=74, libro="Huejutla"),
]

NUMERICOS_HUJ = [
    Numerico("Material", "cantidad", 136,
             "Regla 1 · numero guardado como texto", libro="Huejutla"),
]

# ---------------------------------------------------------------------------
# Las correcciones de Actopan
# ---------------------------------------------------------------------------
# El libro se armo copiando hojas de distintos almacenes, asi que la columna
# Sub-ubicacion tampoco quedo actualizada: Reactivos dice «N4» y Insumos y
# Material dicen «N3». Sin corregirla, la regla de sub-ubicacion tira las tres
# hojas enteras. El destino confirmado es el almacen ACT.
SUB_UBICACION_ACT = [
    Correccion(hoja, "sub_ubicacion", buscar, "ACT",
               "Archivo mal rotulado · el libro es de Actopan",
               libro="Actopan", esperadas=n)
    for hoja, buscar, n in (("Reactivos", "N4", 64),
                            ("Insumos", "N3", 32),
                            ("Material", "N3", 37))
]

# La misma errata de mueble que en N3 y Huejutla, acotada a este libro:
# 19+12+6 = 37 «Gabienete».
MUEBLES_ACT = [
    Correccion("Material", "mueble", "Gabienete", "Gabinete",
               "Regla 5 · errata de mueble; el ETL propone el destino",
               esperadas=37, libro="Actopan"),
]

CORRECCIONES = (MUEBLES + PARTIDOS + ERRATAS + PRESENTACION + MARCAS
                + SUB_UBICACION_HUJ + MUEBLES_HUJ + SUB_UBICACION_ACT
                + MUEBLES_ACT)

# 6. Regla 1. Un numero guardado como texto. `normalizar.numero()` lo rechaza y
#    con el se cae la hoja entera de Material.
#
#    Ojo: la fila 136 es tambien uno de los seis «Tapón» que estan en kg
#    mientras el resto esta en g. Eso NO se toca aqui: convertir 0.5 kg a 500 g
#    es exactamente la clase de decision que va a la pantalla de depuracion.
NUMERICOS = [
    Numerico("Material", "cantidad", 136,
             "Regla 1 · numero guardado como texto", libro="Nivel-3"),
] + NUMERICOS_HUJ


@dataclass
class Bitacora:
    filas: list[dict[str, str]] = field(default_factory=list)

    def anotar(self, **campos: str) -> None:
        self.filas.append(campos)

    def a_csv(self, ruta: Path) -> None:
        # utf-8-sig por lo mismo que informe.py: este archivo lo abre gente en
        # Excel, y sin BOM los acentos salen rotos.
        with ruta.open("w", encoding="utf-8-sig", newline="") as f:
            escritor = csv.DictWriter(f, fieldnames=COLUMNAS)
            escritor.writeheader()
            escritor.writerows(self.filas)


def _letra(hoja: str, campo: str) -> str:
    """La columna sale de formato.CAMPOS, no de una constante propia.

    Si algun dia el formato mueve una columna, esto se mueve con el ETL en vez
    de corregir la celda equivocada en silencio.
    """
    try:
        return CAMPOS[hoja][campo]
    except KeyError as error:
        raise SystemExit(
            f"«{campo}» no es un campo de la hoja «{hoja}» en formato.CAMPOS") from error


def _aplicar(ws, correccion: Correccion, archivo: str,
             bitacora: Bitacora) -> int:
    letra = _letra(correccion.hoja, correccion.campo)
    filas = correccion.filas or range(1, ws.max_row + 1)
    cambiadas = 0
    for fila in filas:
        celda = ws[f"{letra}{fila}"]
        if not isinstance(celda.value, str) or correccion.buscar not in celda.value:
            continue
        antes = celda.value
        celda.value = antes.replace(correccion.buscar, correccion.poner)
        cambiadas += 1
        bitacora.anotar(archivo=archivo, hoja=correccion.hoja,
                        celda=f"{letra}{fila}", campo=correccion.campo,
                        antes=antes, despues=celda.value,
                        motivo=correccion.motivo)
    return cambiadas


def _aplicar_numerico(ws, numerico: Numerico, archivo: str,
                      bitacora: Bitacora) -> int:
    letra = _letra(numerico.hoja, numerico.campo)
    celda = ws[f"{letra}{numerico.fila}"]
    if not isinstance(celda.value, str):
        return 0
    antes = celda.value
    try:
        celda.value = float(antes.replace(",", "."))
    except ValueError:
        raise SystemExit(f"{archivo} {numerico.hoja}!{letra}{numerico.fila}: "
                         f"«{antes}» no se puede leer como numero")
    # «(número)» y no solo el valor: en el CSV, «0.5 -> 0.5» no deja ver que lo
    # que cambio fue el tipo, que es justo el motivo de la correccion.
    bitacora.anotar(archivo=archivo, hoja=numerico.hoja,
                    celda=f"{letra}{numerico.fila}", campo=numerico.campo,
                    antes=f"{antes} (texto)",
                    despues=f"{celda.value} (número)",
                    motivo=numerico.motivo)
    return 1


def corregir(origen: Path, destino: Path) -> Bitacora:
    """Copia el libro y le aplica las correcciones. Devuelve la bitacora."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    # copy2 y no una escritura nueva: si una hoja no lleva ninguna correccion,
    # el archivo de destino sigue siendo byte a byte el original.
    shutil.copy2(origen, destino)

    # data_only=True a proposito, aunque parezca lo contrario. openpyxl no
    # guarda las dos cosas de una formula: con data_only=False conserva el texto
    # «=L10-K10» pero pierde el valor cacheado, y con data_only=True conserva el
    # valor pero convierte la formula en su resultado. El cargador lee con
    # data_only=True, asi que la primera opcion deja la cantidad en None y la
    # mete como cero SIN un solo error. El libro de Actopan trae exactamente esa
    # formula en la cantidad de Reactivos; N3 y Huejutla no. Se materializa el
    # valor y el corregido queda cargable.
    libro = load_workbook(destino, data_only=True)
    bitacora = Bitacora()
    cuenta: dict[int, int] = {}

    for i, correccion in enumerate(CORRECCIONES):
        if correccion.libro and correccion.libro.lower() not in str(origen).lower():
            continue
        if correccion.hoja not in libro.sheetnames:
            continue
        cuenta[i] = _aplicar(libro[correccion.hoja], correccion,
                             destino.name, bitacora)

    for numerico in NUMERICOS:
        if numerico.libro and numerico.libro.lower() not in str(origen).lower():
            continue
        if numerico.hoja in libro.sheetnames:
            _aplicar_numerico(libro[numerico.hoja], numerico, destino.name,
                              bitacora)

    libro.save(destino)

    problemas = [
        f"  {c.hoja}·{c.campo} «{c.buscar}»: esperaba {c.esperadas}, cambio {cuenta[i]}"
        for i, c in enumerate(CORRECCIONES)
        if c.esperadas is not None and i in cuenta and cuenta[i] != c.esperadas
    ]
    if problemas:
        raise SystemExit("El archivo no es el que se reviso:\n" + "\n".join(problemas))

    return bitacora


# openpyxl serializa los numeros con «%.16g» y Excel guardaba hasta 17 cifras
# significativas, asi que 44.459999999999994 se reescribe 44.45999999999999. La
# deriva es de 4e-15 gramos: ruido de IEEE754 heredado de restar dos pesos en
# Excel, no un cambio de dato. Se tolera, pero se mide y se reporta: pasarlo por
# alto sin medirlo seria justo lo que este archivo existe para no hacer.
TOLERANCIA_RELATIVA = 1e-12


def _iguales(a, b) -> tuple[bool, float]:
    """Devuelve (si son el mismo valor, deriva relativa si son numeros)."""
    if isinstance(a, float) and isinstance(b, float):
        escala = max(abs(a), abs(b), 1.0)
        deriva = abs(a - b) / escala
        return deriva <= TOLERANCIA_RELATIVA, deriva
    return a == b, 0.0


def verificar(origen: Path, destino: Path,
              tocadas: set[tuple[str, str]]) -> tuple[list[str], list[str]]:
    """Que el corregido difiera del original SOLO en las celdas de la bitacora.

    Devuelve (fallas, notas). Una falla es motivo para tirar el archivo.

    Se comprueba celda por celda sobre TODO el libro, no solo sobre las columnas
    que el ETL mapea: una correccion que se lleve por delante una celda de la
    hoja «Reglas de captura» tiene que salir aqui. Y se comprueban las
    validaciones de datos —los desplegables del formato— porque si openpyxl las
    pierde, el archivo ya no sirve para devolverselo al almacen.
    """
    a = load_workbook(origen, data_only=True)
    b = load_workbook(destino, data_only=True)
    fallas: list[str] = []
    notas: list[str] = []

    if a.sheetnames != b.sheetnames:
        fallas.append(f"hojas: {a.sheetnames} -> {b.sheetnames}")
        return fallas, notas

    for nombre in a.sheetnames:
        ha, hb = a[nombre], b[nombre]

        if len(ha.merged_cells.ranges) != len(hb.merged_cells.ranges):
            fallas.append(f"{nombre}: celdas combinadas "
                          f"{len(ha.merged_cells.ranges)} -> "
                          f"{len(hb.merged_cells.ranges)}")
        va = len(ha.data_validations.dataValidation)
        vb = len(hb.data_validations.dataValidation)
        if va != vb:
            fallas.append(f"{nombre}: validaciones de datos {va} -> {vb}")

        # Una columna que se encoge solo es aceptable si estaba vacia. La
        # fantasma «N» de Material lo estaba; openpyxl no la reescribe.
        if hb.max_column < ha.max_column:
            perdidas = [
                c for c in range(hb.max_column + 1, ha.max_column + 1)
                if any(ha.cell(row=r, column=c).value is not None
                       for r in range(1, ha.max_row + 1))]
            if perdidas:
                fallas.append(f"{nombre}: se perdieron columnas con dato: {perdidas}")
            else:
                notas.append(f"{nombre}: se descarto/aron "
                             f"{ha.max_column - hb.max_column} columna(s) "
                             f"fantasma, sin una sola celda con dato")

        esperadas = ruido = 0
        deriva_max = 0.0
        for fila in range(1, ha.max_row + 1):
            for col in range(1, ha.max_column + 1):
                celda = ha.cell(row=fila, column=col)
                va_, vb_ = celda.value, hb.cell(row=fila, column=col).value
                if (nombre, celda.coordinate) in tocadas:
                    esperadas += 1
                    continue
                igual, deriva = _iguales(va_, vb_)
                if igual:
                    if deriva:
                        ruido += 1
                        deriva_max = max(deriva_max, deriva)
                    continue
                fallas.append(f"{nombre}!{celda.coordinate} cambio sin estar en "
                              f"la bitacora: {va_!r} -> {vb_!r}")

        notas.append(f"{nombre}: {esperadas} celdas corregidas, "
                     f"{ruido} con ruido de coma flotante "
                     f"(deriva maxima {deriva_max:.1e})")

    return fallas, notas


def _tocadas(ruta: Path) -> set[tuple[str, str]]:
    """Las celdas que la bitacora dice haber cambiado."""
    if not ruta.exists():
        return set()
    with ruta.open(encoding="utf-8-sig", newline="") as f:
        return {(fila["hoja"], fila["celda"]) for fila in csv.DictReader(f)}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Corrige lo determinista del origen.")
    p.add_argument("--verificar", action="store_true",
                   help="no regenera; solo comprueba lo que ya hay")
    args = p.parse_args(argv)

    if not ORIGINAL.is_dir():
        print(f"No existe {ORIGINAL}", file=sys.stderr)
        return 2

    total = fallas_totales = 0
    for origen in sorted(ORIGINAL.rglob("*.xlsx")):
        if origen.name.startswith("~$"):
            continue
        destino = CORREGIDO / origen.relative_to(ORIGINAL)
        print(f"  {origen.relative_to(DATOS)}")

        if not args.verificar:
            bitacora = corregir(origen, destino)
            bitacora.a_csv(destino.parent / BITACORA)
            total += len(bitacora.filas)
            print(f"    {len(bitacora.filas)} celdas corregidas → {BITACORA}")

        if not destino.exists():
            print(f"    falta {destino.relative_to(DATOS)}", file=sys.stderr)
            return 1

        fallas, notas = verificar(origen, destino,
                                  _tocadas(destino.parent / BITACORA))
        for nota in notas:
            print(f"    ok · {nota}")
        for falla in fallas:
            print(f"    FALLA · {falla}", file=sys.stderr)
        fallas_totales += len(fallas)

    if not args.verificar:
        print(f"\n  {total} correcciones en total. El original no se toco.")
    if fallas_totales:
        print(f"  {fallas_totales} fallas: el corregido NO es fiable.",
              file=sys.stderr)
        return 1
    print("  El corregido difiere del original solo en las celdas de la bitacora.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
