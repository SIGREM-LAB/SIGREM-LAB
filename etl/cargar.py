"""El comando. Sin --cargar no escribe nada.

    python -m etl.cargar --juego limpios              simulacro
    python -m etl.cargar --juego defectos             el informe con los 22
    python -m etl.cargar --juego limpios --cargar     escribe de verdad

Diseño: docs/specs/2026-08-20-etl-carga-formato-unificado-design.md
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys
from pathlib import Path

from etl.extract.formato import leer, slug
from etl.review.informe import Informe, Problema
from etl.rules.validar import Catalogos, Renglon, Vistos, validar

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


def simular(origen: Path, catalogos: Catalogos,
            almacen: str | None = None
            ) -> tuple[Informe, dict[str, tuple[Renglon, ...]]]:
    """Lee y valida sin tocar la base."""
    informe, vistos = Informe(), Vistos()
    renglones: dict[str, tuple[Renglon, ...]] = {}
    for ruta in archivos(origen, almacen):
        hoja = leer(ruta)
        validos = validar(hoja, informe, catalogos, vistos)
        if validos is not None:
            renglones[ruta.name] = validos
    return informe, renglones


def cargar(origen: Path, cadena: str,
           almacen: str | None = None) -> tuple[Informe, int]:
    """Una transacción por archivo: la hoja entra entera o no entra."""
    from etl import db, destino

    informe, vistos, nuevas = Informe(), Vistos(), 0
    with db.conectar(cadena) as con:
        with con.cursor() as cur:
            catalogos = db.catalogos(cur)
            perfil = db.perfil_de_carga(cur)
        con.commit()

        for ruta in archivos(origen, almacen):
            hoja = leer(ruta)
            validos = validar(hoja, informe, catalogos, vistos)
            if validos is None:
                continue
            try:
                with con.cursor() as cur:
                    nuevas += destino.escribir_hoja(cur, hoja, validos, perfil)
                con.commit()
            except Exception as error:  # noqa: BLE001 — se anota y se sigue
                con.rollback()
                informe.anotar(Problema(
                    archivo=hoja.archivo, hoja=hoja.nombre, fila=None,
                    columna="", regla="Error de la base", valor="",
                    accion="rechazo", detalle=str(error).strip()))
    return informe, nuevas


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
        informe, nuevas = cargar(origen, db.dsn(args.dsn), args.almacen)
        print(f"  {nuevas} existencias nuevas")
    else:
        # El simulacro corre sin base, pero si la hay se aprovecha: el único
        # control que no se puede hacer en frío es el del laboratorio.
        informe, renglones = simular(origen, _catalogos_si_hay(args.dsn),
                                     args.almacen)
        total = sum(len(r) for r in renglones.values())
        print(f"  {len(renglones)} hojas listas, {total} renglones")

    ruta = REVIEW / f"{dt.date.today():%Y-%m-%d}-{origen.name}.csv"
    informe.a_csv(ruta)
    print(f"  {len(informe.rechazos)} rechazos, "
          f"{len(informe.normalizados)} normalizados → "
          f"{ruta.relative_to(RAIZ)}")

    if informe.archivos_rechazados:
        print("  hojas rechazadas: "
              + ", ".join(sorted(informe.archivos_rechazados)))
    if not args.cargar:
        print("  simulacro: no se escribió nada. Agrega --cargar.")
    return 1 if informe.rechazos else 0


if __name__ == "__main__":
    raise SystemExit(main())
