"""El comando. Sin --cargar no escribe nada.

    python -m etl.cargar --juego limpios              simulacro
    python -m etl.cargar --juego defectos             el informe con los 22
    python -m etl.cargar --juego limpios --cargar     escribe de verdad

    # los archivos reales, un libro por almacén
    python -m etl.cargar --origen etl/Datos-Reales-JD2026/corregido
    python -m etl.cargar --origen etl/Datos-Reales-JD2026/corregido --cargar

Lo válido entra a `existencia`; lo que ninguna regla puede resolver sola se
aparta en `public.carga_pendiente` y lo revisa una persona en pantalla. Hasta el
26 de agosto de 2026 esto era todo-o-nada y el primer archivo real cargaba cero.

Diseño: docs/specs/2026-08-20-etl-carga-formato-unificado-design.md
Pantalla: docs/plans/2026-08-26-pantalla-depuracion-inventario.md
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

from etl.extract.formato import Hoja, almacen_de, leer, leer_libro, slug
from etl.review.informe import Informe, Problema
from etl.rules.validar import Catalogos, Resultado, Vistos, validar

RAIZ = Path(__file__).resolve().parents[1]
EJEMPLOS = RAIZ / "etl" / "ejemplos" / "datos-almacenes"
REVIEW = RAIZ / "etl" / "review"

# Fijo, para que la corrida sea reproducible. El orden importa: `articulo` es
# global, así que la deduplicación solo se ejercita con varios almacenes juntos.
ORDEN = ("N3", "N4", "LUM", "LE")
ORDEN_HOJAS = ("Reactivos", "Insumos", "Material", "Equipos",
               "Materia biológica", "Electrónica")


def archivos(origen: Path, almacen: str | None = None) -> list[Path]:
    """Los archivos que hay, en orden fijo.

    El emparejamiento es por slug COMPLETO, no por prefijo: «Material» y
    «Materia biológica» comparten las seis primeras letras y un startswith los
    cruzaría.
    """
    rutas: list[Path] = []
    for clave in ORDEN:
        if almacen and clave != almacen:
            continue
        carpeta = origen / clave
        if not carpeta.is_dir():
            continue
        por_hoja = {r.stem.partition("-")[2].lower(): r
                    for r in carpeta.glob("*.xlsx")
                    if not r.name.startswith("~$")}
        for hoja in ORDEN_HOJAS:
            ruta = por_hoja.get(slug(hoja))
            if ruta is not None:
                rutas.append(ruta)
    return rutas


def hojas_de(origen: Path, almacen: str | None = None) -> list[Hoja]:
    """Todas las hojas de datos del origen, en el orden de carga.

    Reconoce las dos formas en que llegan los archivos:

      un archivo por almacén-hoja   `limpios/N3/N3-Reactivos.xlsx`  (ejemplos)
      un libro por almacén          `Almacén-Nivel-3/Inventario.xlsx` (reales)

    El orden lo fija ORDEN × ORDEN_HOJAS y no el sistema de archivos: `articulo`
    es global, así que cuál renglón crea el artículo y cuál lo reutiliza depende
    del orden de carga. Que eso lo decidiera el orden alfabético de una carpeta
    haría la migración irreproducible.
    """
    if archivos(origen, almacen):
        return [leer(ruta) for ruta in archivos(origen, almacen)]

    libros: list[tuple[str, Path]] = []
    for ruta in sorted(origen.rglob("*.xlsx")):
        if ruta.name.startswith("~$"):
            continue
        clave = almacen_de(ruta)
        if almacen and clave != almacen:
            continue
        libros.append((clave, ruta))

    hojas: list[Hoja] = []
    for clave in ORDEN:
        for suya, ruta in libros:
            if suya == clave:
                hojas.extend(leer_libro(ruta, clave))
    return hojas


def simular(origen: Path, catalogos: Catalogos,
            almacen: str | None = None
            ) -> tuple[Informe, dict[str, Resultado]]:
    """Lee y valida sin tocar la base."""
    informe, vistos = Informe(), Vistos()
    resultados: dict[str, Resultado] = {}
    for hoja in hojas_de(origen, almacen):
        resultados[f"{hoja.archivo} · {hoja.nombre}"] = validar(
            hoja, informe, catalogos, vistos)
    return informe, resultados


def cargar(origen: Path, cadena: str,
           almacen: str | None = None) -> tuple[Informe, int, int]:
    """Una transacción por hoja: entra lo válido y se aparta lo demás.

    La transacción sigue siendo por hoja, pero ya no es todo-o-nada sobre el
    contenido. Lo que sí es atómico es el par: o entran las existencias Y su
    lista de pendientes, o no entra ninguna de las dos cosas. Un inventario
    cargado sin la lista de lo que quedó fuera es un inventario que se cree
    completo y no lo está.
    """
    from etl import db, destino

    informe, vistos = Informe(), Vistos()
    nuevas = apartados = 0
    with db.conectar(cadena) as con:
        with con.cursor() as cur:
            catalogos = db.catalogos(cur)
            perfil = db.perfil_de_carga(cur)
        con.commit()

        for hoja in hojas_de(origen, almacen):
            resultado = validar(hoja, informe, catalogos, vistos)
            if not resultado.validos and not resultado.rechazados:
                continue
            try:
                with con.cursor() as cur:
                    n, a = destino.escribir_hoja(cur, hoja, resultado, perfil)
                nuevas += n
                apartados += a
                con.commit()
            except Exception as error:  # noqa: BLE001 — se anota y se sigue
                con.rollback()
                informe.anotar(Problema(
                    archivo=hoja.archivo, hoja=hoja.nombre, fila=None,
                    columna="", regla="Error de la base", valor="",
                    accion="rechazo", detalle=str(error).strip()))
    return informe, nuevas, apartados


def _catalogos_si_hay(explicito: str | None) -> Catalogos:
    """Los catálogos de la base si se alcanza; vacíos si no.

    Un simulacro no debe exigir Docker. Pero cuando la base está ahí, saltarse
    la comprobación de laboratorio sería tirar información que sí tenemos.
    """
    try:
        from etl import db
        with db.conectar(db.dsn(explicito)) as con, con.cursor() as cur:
            return db.catalogos(cur)
    except Exception:  # noqa: BLE001 — sin base se sigue igual, y el informe lo dice
        return Catalogos()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Carga el formato unificado.")
    p.add_argument("--juego", choices=("limpios", "defectos"))
    p.add_argument("--origen", type=Path)
    p.add_argument("--almacen", choices=ORDEN)
    p.add_argument("--cargar", action="store_true",
                   help="escribe en la base; sin esto es simulacro")
    p.add_argument("--dsn", help="por omisión, DATABASE_URL")
    args = p.parse_args(argv)

    origen = args.origen or (EJEMPLOS / (args.juego or "limpios"))
    if not origen.is_dir():
        print(f"No existe {origen}", file=sys.stderr)
        return 2

    if args.cargar:
        from etl import db
        informe, nuevas, apartados = cargar(origen, db.dsn(args.dsn),
                                            args.almacen)
        print(f"  {nuevas} existencias nuevas")
        print(f"  {apartados} renglones apartados para revisión "
              f"(public.carga_pendiente)")
    else:
        # El simulacro corre sin base, pero si la hay se aprovecha: el único
        # control que no se puede hacer en frío es el del laboratorio.
        informe, resultados = simular(origen, _catalogos_si_hay(args.dsn),
                                      args.almacen)
        validos = sum(len(r.validos) for r in resultados.values())
        apartados = sum(len(r.rechazados) for r in resultados.values())
        print(f"  {len(resultados)} hojas, {validos} renglones cargables, "
              f"{apartados} para revisión")

    ruta = REVIEW / f"{dt.date.today():%Y-%m-%d}-{origen.name}.csv"
    informe.a_csv(ruta)
    print(f"  {len(informe.rechazos)} rechazos, "
          f"{len(informe.normalizados)} normalizados → "
          f"{ruta.relative_to(RAIZ)}")

    # Ya no hay «hojas rechazadas»: una hoja con rechazos entra igual, por lo
    # válido. Lo que se lista es de qué archivos salió trabajo de revisión.
    if informe.archivos_rechazados:
        print("  archivos con renglones por revisar: "
              + ", ".join(sorted(informe.archivos_rechazados)))
    if not args.cargar:
        print("  simulacro: no se escribió nada. Agrega --cargar.")
    return 1 if informe.rechazos else 0


if __name__ == "__main__":
    raise SystemExit(main())
