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
from etl.rules.validar import Resultado

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

# El separador va suelto a proposito. Los archivos reales escriben «CAS: 67-64-1»,
# «CAS 112926-00-8», «CAS. 5949-29-1» y «CAS1310-73-2»; exigir los dos puntos
# tiraba el CAS de 6 renglones de N3 sin decir nada. Lo que NO se afloja es la
# forma del numero: 2-7 digitos, 2 digitos y el verificador. Un CAS mal formado
# es mejor ausente que inventado.
CAS = re.compile(r"CAS[\s:.]*([0-9]{2,7}-[0-9]{2}-[0-9])", re.IGNORECASE)


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
    """El encabezado la trae como dd/mm/aaaa; Postgres la quiere ISO.

    El formato unificado trae la casilla como `___/___/______`, y los almacenes
    la entregan sin llenar. Eso tiene barras, así que la versión anterior partía
    feliz y devolvía `'______-___-___'`, que se iba tal cual a `carga.actualizado_el`
    —columna `date`— y Postgres abortaba la transacción de la hoja ENTERA. Las
    tres hojas de N3 se caían por una casilla vacía del encabezado.

    Sin fecha se carga igual: `actualizado_el` es nullable justamente porque es
    metadato de procedencia, no un dato del inventario.
    """
    if not texto or "/" not in texto:
        return None
    partes = texto.split("/")
    if len(partes) != 3 or not all(p.strip().isdigit() for p in partes):
        return None
    dia, mes, anio = (p.strip() for p in partes)
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
                       campos: dict[str, Any]) -> tuple[int, int | None] | None:
    """Punto 9 del contrato: la llave natural de una existencia.

    Devuelve (id, carga_id). El `carga_id` es lo que distingue dos situaciones
    que se ven igual: si la existencia que choca viene de ESTA misma carga, dos
    renglones del archivo comparten llave natural —los 20 frascos de Ergosterol
    de N3— y hay que apartarlos para que alguien decida. Si viene de una carga
    anterior, es el cargador corriendo dos veces sobre el mismo archivo y hay
    que saltarla en silencio, que es lo que lo hace idempotente.
    """
    serie = campos.get("numero_serie")
    inv = campos.get("numero_inventario")

    if hoja.nombre == "Equipos" and (serie is not None or inv is not None):
        cur.execute(
            "select id, carga_id from public.existencia "
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
            select id, carga_id from public.existencia
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
            select id, carga_id from public.existencia
             where articulo_id = %s and almacen_id = %s
               and ubicacion_id is not distinct from %s
               and marca        is not distinct from %s
               and presentacion is not distinct from %s
             limit 1
            """,
            (articulo_id, almacen_id, ubicacion_id, campos.get("marca"),
             campos.get("presentacion")))
    fila = cur.fetchone()
    return (fila[0], fila[1]) if fila else None


def _apartable(valor: Any) -> Any:
    """Lo que no es JSON nativo se guarda como texto.

    Las celdas de fecha llegan como `datetime` y json no las sabe escribir. Se
    guardan como texto porque este jsonb es lo que la pantalla PINTA: es el
    renglón tal como venía, para que quien revise vea lo mismo que el Excel.
    """
    if valor is None or isinstance(valor, (bool, int, float, str)):
        return valor
    return str(valor)


def apartar(cur, hoja: Hoja, almacen_id: int, carga_id: int | None, fila: int,
            motivo: str, crudo: dict[str, Any], problemas: list[dict[str, Any]],
            existencia_id: int | None = None) -> bool:
    """Deja un renglón esperando revisión humana. Devuelve si era nuevo.

    El `do update` NO toca `estado`, `nota` ni `revisado_por` a propósito: si el
    almacén vuelve a mandar el archivo y el cargador se corre otra vez, el
    trabajo de revisión ya hecho tiene que sobrevivir. Lo que sí se refresca es
    el hallazgo —renglón y problemas—, porque puede haber cambiado.

    `carga_id` tampoco se actualiza: el pendiente pertenece a la carga que lo
    encontró la primera vez. Reasignarlo a la corrida más reciente rompía el
    cuadre de `carga.filas`, porque los renglones se iban a una carga nueva
    mientras sus existencias hermanas se quedaban en la vieja.

    Devuelve True solo si insertó. `xmax = 0` es la forma de distinguir un
    INSERT de un UPDATE en un upsert, y sin esa distinción una segunda corrida
    sobre el mismo archivo se veía como trabajo nuevo y dejaba una fila de
    `carga` huérfana por hoja.
    """
    cur.execute(
        """
        insert into public.carga_pendiente
          (almacen_id, carga_id, archivo, hoja, fila, motivo, renglon,
           problemas, existencia_id)
        values (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
        on conflict (almacen_id, archivo, hoja, fila) do update
           set motivo        = excluded.motivo,
               renglon       = excluded.renglon,
               problemas     = excluded.problemas,
               existencia_id = excluded.existencia_id
        returning (xmax = 0) as insertado
        """,
        (almacen_id, carga_id, hoja.archivo, hoja.nombre, fila, motivo,
         _json({k: _apartable(v) for k, v in crudo.items()}),
         _json(problemas), existencia_id))
    return cur.fetchone()[0]


def escribir_hoja(cur, hoja: Hoja, resultado: Resultado,
                  perfil_id: uuid.UUID) -> tuple[int, int]:
    """Devuelve (existencias nuevas, renglones apartados)."""
    almacen_id = db.almacenes(cur)[hoja.almacen]
    labs = db.laboratorios(cur)
    renglones = resultado.validos
    # `filas` son los renglones que traía la HOJA, no los que el validador
    # aprobó. Así la fila de `carga` se autoverifica: existencias + pendientes
    # de esa carga tienen que dar exactamente este número. Con los válidos
    # intentados no cuadraba, porque un renglón válido puede acabar apartado por
    # chocar en la llave natural, y salía contado dos veces.
    carga_id = crear_carga(cur, hoja, almacen_id, perfil_id, len(hoja.filas))
    nuevas = apartados = 0

    # Lo que ninguna regla puede resolver sola. Se aparta ANTES de escribir nada
    # para que un error de la base más adelante no se lleve por delante la lista
    # de lo que hay que revisar: es la única copia de por qué esos renglones no
    # entraron.
    for rechazado in resultado.rechazados:
        if apartar(cur, hoja, almacen_id, carga_id, rechazado.fila, "regla",
                   rechazado.crudo,
                   [{"regla": p.regla, "columna": p.columna,
                     "valor": _apartable(p.valor), "detalle": p.detalle}
                    for p in rechazado.problemas]):
            apartados += 1

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
            previa_id, previa_carga = previa
            # Choque DENTRO de esta misma carga: dos renglones del archivo que
            # la llave natural no sabe separar. Los 20 frascos de Ergosterol de
            # N3 caen aquí. Antes se descartaban en silencio —217 renglones de
            # Reactivos y 11 de Material— y nadie se enteraba.
            if hoja.nombre != "Equipos" and previa_carga == carga_id:
                nuevo = apartar(
                        cur, hoja, almacen_id, carga_id, renglon.fila,
                        "posible_duplicado", c,
                        [{"regla": "Llave natural · (articulo, ubicacion, "
                                   "marca, presentacion)",
                          "columna": "",
                          "valor": _apartable(c.get("cantidad")),
                          "detalle": "otro renglón de este mismo archivo ocupa "
                                     "la misma llave. ¿Son dos frascos "
                                     "distintos, o el mismo capturado dos "
                                     "veces?"}],
                        existencia_id=previa_id)
                apartados += 1 if nuevo else 0
            # Si la previa es de una carga ANTERIOR, es el cargador corriendo
            # dos veces sobre el mismo archivo: se salta y ya.
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
    # detrás. Se borra solo si TAMPOCO apartó nada: un pendiente sin su carga
    # pierde de dónde salió, que es la mitad de lo que necesita quien lo revisa.
    if nuevas == 0 and apartados == 0:
        cur.execute("delete from public.carga where id = %s", (carga_id,))

    return nuevas, apartados
