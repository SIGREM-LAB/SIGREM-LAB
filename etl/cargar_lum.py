"""Carga de una hoja de un libro de LUM en Supabase remoto."""

from __future__ import annotations

import argparse
import datetime as dt
import os
from pathlib import Path

from dotenv import load_dotenv
from psycopg.conninfo import conninfo_to_dict

from etl.extract.formato import leer_libro
from etl.review.informe import Informe
from etl.rules.validar import Vistos, validar

RAIZ = Path(__file__).resolve().parents[1]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archivo", type=Path, help="Excel original de LUM")
    parser.add_argument("--hoja", choices=("Reactivos", "Equipos"),
                        default="Reactivos", help="hoja del libro que se procesa")
    parser.add_argument("--cargar", action="store_true",
                        help="escribe; por omisión solo valida")
    args = parser.parse_args(argv)
    if not args.archivo.is_file() or args.archivo.suffix.lower() != ".xlsx":
        parser.error("Se requiere un archivo .xlsx existente.")

    # Se carga antes de importar db, que obtiene la identidad del entorno.
    load_dotenv(RAIZ / ".env.remoto")
    from etl import db, destino

    cadena = os.environ.get("DATABASE_URL", "")
    correo = os.environ.get("ETL_CORREO_CARGA", "")
    if not cadena or not correo:
        parser.error("Configura DATABASE_URL y ETL_CORREO_CARGA en .env.remoto.")
    try:
        opciones = conninfo_to_dict(cadena)
    except Exception:
        parser.error("DATABASE_URL no es una conexión PostgreSQL válida.")
    host = opciones.get("host", "")
    if not (host.endswith(".supabase.co") or host.endswith(".supabase.com")):
        parser.error("DATABASE_URL debe apuntar al servidor de Supabase remoto.")
    opciones["sslmode"] = "require"
    opciones["connect_timeout"] = "30"
    db.CORREO_DE_CARGA = correo

    hojas = [h for h in leer_libro(args.archivo, almacen="LUM")
             if h.nombre == args.hoja]
    if len(hojas) != 1 or not hojas[0].renglones:
        parser.error(f"El libro debe contener una hoja {args.hoja} con renglones.")
    hoja = hojas[0]
    informe = Informe()
    import psycopg

    with psycopg.connect(**opciones) as con:
        with con.cursor() as cur:
            # El simulacro tampoco permite escrituras accidentales.
            if not args.cargar:
                cur.execute("set transaction read only")
            perfil = db.perfil_de_carga(cur)
            if "LUM" not in db.almacenes(cur):
                parser.error("El almacén LUM no existe en el destino.")
            resultado = validar(hoja, informe, db.catalogos(cur), Vistos())
            ruta = RAIZ / "etl" / "review" / (
                f"{dt.datetime.now():%Y-%m-%d-%H%M%S}-LUM-{args.hoja.lower()}.csv")
            informe.a_csv(ruta)
            print(f"Destino: {host} | LUM · {args.hoja}")
            print(f"{len(resultado.validos)} cargables; "
                  f"{len(resultado.rechazados)} para revisión. Informe: {ruta}")
            if not args.cargar:
                print("Simulacro terminado: no se escribió en la base.")
                return 0
            # Serializa las cargas ejecutadas mediante esta entrada.
            cur.execute("select pg_advisory_xact_lock(20261020, 1)")
            nuevas, pendientes = destino.escribir_hoja(
                cur, hoja, resultado, perfil)
            if nuevas + pendientes != (
                    len(resultado.validos) + len(resultado.rechazados)):
                raise RuntimeError("El cuadre falló; se revierte la transacción.")
        # El contexto confirma únicamente si toda la hoja terminó correctamente.
    print(f"Carga confirmada: {nuevas} existencias y {pendientes} pendientes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
