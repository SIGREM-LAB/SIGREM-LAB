"""Escribe carga, ubicacion, existencia y movimiento.

La transacción por archivo la abre quien llama: aquí todo corre sobre el mismo
cursor y no se hace commit.
"""

from __future__ import annotations

import re
import uuid
from typing import Any

from etl import catalogo, db
from etl.extract.formato import Hoja
from etl.rules.normalizar import clave
from etl.rules.validar import Renglon

# La clasificación sale de la hoja, salvo en las dos que traen columna propia.
CLASIFICACION_POR_HOJA = {
    "Reactivos": "reactivo",
    "Equipos": "equipo",
    "Materia biológica": "materia_biologica",
}
CLASIFICACION_POR_TEXTO = {
    "material": "material", "insumo": "insumo", "equipo": "equipo",
    "reactivo": "reactivo", "materia biologica": "materia_biologica",
    "componente": "componente",
}

# El orden de la etiqueta sale de aquí, no del diccionario: dos renglones con
# los mismos componentes tienen que producir la misma etiqueta, siempre.
PARTES = (("sub_ubicacion", ""), ("mueble", ""), ("repisa", "Repisa "),
          ("fila_cajon", "Fila "), ("coord_h", "H"), ("coord_v", "V"),
          ("coord_i", "I"))
CLAVES_DE_UBICACION = {campo for campo, _ in PARTES}

CAS = re.compile(r"CAS:\s*([0-9]{2,7}-[0-9]{2}-[0-9])")


def etiqueta_de(componentes: dict[str, Any]) -> str:
    trozos = [f"{prefijo}{componentes[campo]}"
              for campo, prefijo in PARTES
              if componentes.get(campo) not in (None, "")]
    return " · ".join(trozos)


def upsert_ubicacion(cur, almacen_id: int,
                     componentes: dict[str, Any]) -> int | None:
    limpios = {k: str(v) for k, v in componentes.items()
               if k in CLAVES_DE_UBICACION and v not in (None, "")}
    if not limpios:
        return None
    cur.execute(
        """
        insert into public.ubicacion (almacen_id, etiqueta, componentes)
        values (%s, %s, %s::jsonb)
        on conflict (almacen_id, etiqueta)
          do update set etiqueta = excluded.etiqueta
        returning id
        """,
        (almacen_id, etiqueta_de(componentes), _json(limpios)))
    return cur.fetchone()[0]


def _json(d: dict[str, str]) -> str:
    import json
    return json.dumps(d, ensure_ascii=False)


def _fecha(texto: str | None) -> str | None:
    """El encabezado la trae como dd/mm/aaaa; Postgres la quiere ISO."""
    if not texto or "/" not in texto:
        return None
    dia, mes, anio = texto.split("/")
    return f"{anio}-{mes}-{dia}"


def crear_carga(cur, hoja: Hoja, almacen_id: int, perfil_id: uuid.UUID,
                filas: int) -> int:
    cur.execute(
        """
        insert into public.carga
          (almacen_id, archivo, hoja, periodo, actualizado_el, responsable,
           filas, cargado_por)
        values (%s, %s, %s, %s, %s, %s, %s, %s) returning id
        """,
        (almacen_id, hoja.archivo, hoja.nombre, hoja.periodo,
         _fecha(hoja.actualizado), hoja.responsable, filas, perfil_id))
    return cur.fetchone()[0]


def _clasificacion(hoja: Hoja, campos: dict[str, Any]) -> str:
    if hoja.nombre in CLASIFICACION_POR_HOJA:
        return CLASIFICACION_POR_HOJA[hoja.nombre]
    return CLASIFICACION_POR_TEXTO[clave(campos.get("clasificacion") or "insumo")]


def _existencia_previa(cur, hoja: Hoja, almacen_id: int, articulo_id: int,
                       ubicacion_id: int | None,
                       campos: dict[str, Any]) -> int | None:
    """Punto 9 del contrato: la llave natural de una existencia."""
    serie = campos.get("numero_serie")
    inv = campos.get("numero_inventario")

    if hoja.nombre == "Equipos" and (serie is not None or inv is not None):
        cur.execute(
            "select id from public.existencia "
            " where (numero_serie is not null and numero_serie = %s) "
            "    or (numero_inventario_uaeh is not null "
            "        and numero_inventario_uaeh = %s) limit 1",
            (serie, inv))
    elif hoja.nombre == "Equipos":
        # Un equipo sin serie NI inventario no tiene identidad propia. Lo mejor
        # disponible es dónde está y qué es; sin esto, cada corrida lo vuelve a
        # crear. Dos equipos así, iguales y en el mismo mueble, se colapsarían
        # en uno: es justo lo que la regla 10 pide evitar poniéndoles serie.
        cur.execute(
            """
            select id from public.existencia
             where articulo_id = %s and almacen_id = %s
               and ubicacion_id is not distinct from %s
               and marca  is not distinct from %s
               and modelo is not distinct from %s
             limit 1
            """,
            (articulo_id, almacen_id, ubicacion_id, campos.get("marca"),
             campos.get("modelo")))
    else:
        cur.execute(
            """
            select id from public.existencia
             where articulo_id = %s and almacen_id = %s
               and ubicacion_id is not distinct from %s
               and marca        is not distinct from %s
               and presentacion is not distinct from %s
             limit 1
            """,
            (articulo_id, almacen_id, ubicacion_id, campos.get("marca"),
             campos.get("presentacion")))
    fila = cur.fetchone()
    return fila[0] if fila else None


def escribir_hoja(cur, hoja: Hoja, renglones: tuple[Renglon, ...],
                  perfil_id: uuid.UUID) -> int:
    """Devuelve cuántas existencias NUEVAS se crearon."""
    almacen_id = db.almacenes(cur)[hoja.almacen]
    labs = db.laboratorios(cur)
    carga_id = crear_carga(cur, hoja, almacen_id, perfil_id, len(renglones))
    nuevas = 0

    for renglon in renglones:
        c = renglon.campos
        nombre = c.get("sustancia") or c.get("articulo")
        resolucion = catalogo.resolver(
            cur, nombre=nombre, descripcion=c.get("especificacion"),
            unidad=c["unidad"], clasificacion=_clasificacion(hoja, c),
            familia=c.get("familia"), perfil_id=perfil_id)

        if hoja.nombre == "Reactivos" and resolucion.creado:
            hallado = CAS.search(nombre or "")
            cur.execute(
                """
                insert into public.articulo_reactivo
                  (articulo_id, cas, estado_fisico, color_almacenaje,
                   tiene_hoja_seguridad, caracteristica_toxica,
                   caracteristica_quimica, riesgo_salud, riesgo_inflamabilidad,
                   riesgo_reactividad, peligro_especial,
                   implica_actividad_peligro)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                on conflict (articulo_id) do nothing
                """,
                (resolucion.articulo_id,
                 hallado.group(1) if hallado else None,
                 c.get("estado_fisico"), c.get("color"),
                 c.get("hoja_seguridad"), c.get("caracteristica_toxica"),
                 c.get("caracteristica_quimica"), c.get("riesgo_salud"),
                 c.get("riesgo_inflamabilidad"), c.get("riesgo_reactividad"),
                 c.get("peligro_especial"), c.get("implica_peligro")))

        if hoja.nombre == "Materia biológica" and resolucion.creado:
            cur.execute(
                "insert into public.articulo_biologico "
                "  (articulo_id, origen_especie) values (%s, %s) "
                "on conflict (articulo_id) do nothing",
                (resolucion.articulo_id, c.get("origen_especie")))

        ubicacion_id = upsert_ubicacion(cur, almacen_id, c)
        previa = _existencia_previa(cur, hoja, almacen_id,
                                    resolucion.articulo_id, ubicacion_id, c)
        if previa is not None:
            continue

        lab_id = labs.get((hoja.almacen, clave(c.get("laboratorio") or "")))
        cur.execute(
            """
            insert into public.existencia
              (articulo_id, almacen_id, ubicacion_id, laboratorio_id, carga_id,
               marca, modelo, presentacion, peso_frasco_vacio, peso_total,
               numero_serie, numero_inventario_uaeh, funcionamiento,
               mantenimiento, fecha_chequeo, metodo_conservacion, temperatura,
               fecha_recoleccion, fecha_preparacion, responsable_muestra,
               observaciones)
            values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            returning id
            """,
            (resolucion.articulo_id, almacen_id, ubicacion_id, lab_id, carga_id,
             c.get("marca"), c.get("modelo"), c.get("presentacion"),
             c.get("peso_vacio"), c.get("peso_total"), c.get("numero_serie"),
             c.get("numero_inventario"), c.get("funcionamiento"),
             c.get("mantenimiento"), c.get("fecha_chequeo"),
             c.get("metodo_conservacion"), c.get("temperatura"),
             c.get("fecha_recoleccion"), c.get("fecha_preparacion"),
             c.get("responsable_muestra"), c.get("observaciones")))
        existencia_id = cur.fetchone()[0]
        nuevas += 1

        # Punto 5 del contrato: la cantidad entra por movimiento, nunca directo.
        # Si es cero no se inserta: el trigger ya dejó la existencia en agotado.
        if c["cantidad"]:
            cur.execute(
                """
                insert into public.movimiento
                  (existencia_id, almacen_id, tipo, cantidad, cantidad_antes,
                   cantidad_despues, usuario_id, motivo)
                values (%s, %s, 'carga_inicial', %s, 0, 0, %s, %s)
                """,
                (existencia_id, almacen_id, c["cantidad"], perfil_id,
                 f"Carga inicial desde {hoja.archivo}"))

    # Una carga que no trajo nada nuevo no es historia, es ruido: al re-correr
    # el cargador se acumularía una fila por corrida sin una sola existencia
    # detrás. Nada la referencia todavía, así que se puede borrar.
    if nuevas == 0:
        cur.execute("delete from public.carga where id = %s", (carga_id,))

    return nuevas
