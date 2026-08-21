"""Aplica las 13 reglas de captura y los choques con el esquema.

Devuelve los renglones normalizados, o None si la hoja tuvo algún rechazo: una
hoja entra entera o no entra. Todo lo que aquí se anota como `normalizado` ya
viene corregido en los renglones que se devuelven.

No conoce la base. Lo único que no se puede comprobar sin ella es el
laboratorio, y por eso llega como argumento en `Catalogos`: sin conexión ese
diccionario va vacío, la comprobación se salta y el informe lo dice.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from etl.extract.formato import CAMPOS, Hoja
from etl.review.informe import Informe, Problema
from etl.rules import normalizar as n

R_SUB = "Ubicación · la sub-ubicación no es de este almacén"
R_LAB = "FK compuesta · (laboratorio_id, almacen_id)"
R_SERIE = "Regla 10 · la serie no se repite entre renglones"
R_INV = "Regla 10 · el número de inventario no se repite entre renglones"
R_PESO = "Regla 13 · el peso del frasco vacío va antes que el del lleno"
R_EQUIPO = "Regla 9 · un renglón por equipo físico"
R_UNIDAD = "Contrato §6 · la unidad se valida contra articulo.unidad_base"

# Regla 9: la cuenta de equipos metida en Observaciones es la señal de que un
# renglón representa varios. La regla 1 ya manda los números fuera de las
# columnas de texto, así que aquí no puede haber una cantidad legítima.
VARIOS_EQUIPOS = re.compile(r"\b(\d+)\s+equipos?\b", re.IGNORECASE)

# Los campos de texto que se normalizan igual en todas las hojas. Cada hoja usa
# los que le tocan; los demás sencillamente no están en su CAMPOS.
#
# `unidad` y `mueble` NO están aquí: llevan normalizador propio (reglas 2 y 5).
CAMPOS_DE_TEXTO = (
    "marca", "modelo", "presentacion", "especificacion", "familia",
    "repisa", "fila_cajon", "coord_h", "coord_v", "coord_i", "observaciones",
    "sub_ubicacion", "clasificacion", "metodo_conservacion",
    "temperatura", "fecha_recoleccion", "fecha_preparacion",
    "responsable_muestra", "origen_especie", "laboratorio", "mantenimiento",
    "fecha_chequeo", "peligro_especial", "caracteristica_quimica",
    "caracteristica_toxica",
)


@dataclass(frozen=True)
class Catalogos:
    """Lo que solo existe en la base. Vacío = no hay conexión, se salta."""

    laboratorios: dict[str, set[str]] = field(default_factory=dict)


@dataclass
class Vistos:
    """Estado que cruza archivos dentro de una misma corrida."""

    # valor -> (archivo, fila de Excel) donde se vio por primera vez
    series: dict[str, tuple[str, int]] = field(default_factory=dict)
    inventarios: dict[str, tuple[str, int]] = field(default_factory=dict)
    unidades: dict[str, tuple[str, str]] = field(default_factory=dict)
    # Regla 4: la primera forma con que se escribe una marca gana, y las demás
    # se doblan a ella. «MEYER» y «Meyer» son la misma marca.
    marcas: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class Renglon:
    fila: int
    campos: dict[str, Any]


def _sub_es_del_almacen(sub: str | None, almacen: str) -> bool:
    """«N3» y «LUM-2» sí; «N1-1» en un archivo de N3, no."""
    return sub is None or sub == almacen or sub.startswith(f"{almacen}-")


def validar(hoja: Hoja, informe: Informe, catalogos: Catalogos,
            vistos: Vistos) -> tuple[Renglon, ...] | None:
    letras = CAMPOS[hoja.nombre]
    salida: list[Renglon] = []
    hubo_rechazo = False

    def anota(fila, campo, regla, valor, accion, detalle):
        informe.anotar(Problema(
            archivo=hoja.archivo, hoja=hoja.nombre, fila=fila,
            columna=letras.get(campo, ""), regla=regla, valor=valor,
            accion=accion, detalle=detalle))

    if hoja.nombre == "Equipos" and not catalogos.laboratorios:
        anota(None, "laboratorio", R_LAB, "", "normalizado",
              "sin catálogo de laboratorios: la comprobación se saltó")

    for fila, crudo in zip(hoja.filas, hoja.renglones):
        campos: dict[str, Any] = {}
        rechazado = False

        def aplica(campo, funcion, _crudo=crudo, _fila=fila, _campos=campos):
            """Corre un normalizador sobre el campo y anota lo que salga."""
            nonlocal rechazado, hubo_rechazo
            try:
                v = funcion(_crudo.get(campo))
            except n.Rechazo as r:
                anota(_fila, campo, r.regla, _crudo.get(campo), "rechazo",
                      r.detalle)
                rechazado = hubo_rechazo = True
                return None
            if v.aviso:
                anota(_fila, campo, v.regla or "Normalización",
                      _crudo.get(campo), "normalizado", v.aviso)
            _campos[campo] = v.dato
            return v.dato

        for campo in CAMPOS_DE_TEXTO:
            if campo in letras:
                aplica(campo, n.texto)

        if "mueble" in letras:
            aplica("mueble", n.mueble)

        # Regla 4: la misma marca escrita de dos formas son dos marcas para la
        # computadora. Se dobla a la primera forma vista en la corrida.
        marca = campos.get("marca")
        if marca:
            c = n.clave(marca)
            canonica = vistos.marcas.setdefault(c, marca)
            if canonica != marca:
                anota(fila, "marca", n.R_MARCA, marca, "normalizado",
                      f"«{marca}» y «{canonica}» son la misma marca escrita "
                      f"distinto")
                campos["marca"] = canonica

        sub = campos.get("sub_ubicacion")
        if not _sub_es_del_almacen(sub, hoja.almacen):
            anota(fila, "sub_ubicacion", R_SUB, sub, "rechazo",
                  f"«{sub}» no es una sub-ubicación de {hoja.almacen}")
            rechazado = hubo_rechazo = True

        campo_nombre = "sustancia" if hoja.nombre == "Reactivos" else "articulo"
        nombre = aplica(campo_nombre, n.texto)

        if hoja.nombre == "Equipos":
            # Regla 9: un renglón por equipo físico, así que siempre es 1. Y la
            # hoja no tiene columna de unidad, pero articulo.unidad_base es
            # not null: el cargador tiene que poner una.
            campos["cantidad"] = 1
            campos["unidad"] = "pieza"
        else:
            aplica("cantidad", n.numero)
            aplica("unidad", n.unidad)
            unidad = campos.get("unidad")
            if nombre and unidad:
                antes = vistos.unidades.get(nombre)
                if antes and antes[0] != unidad:
                    anota(fila, "unidad", R_UNIDAD, unidad, "rechazo",
                          f"el mismo artículo está en «{antes[0]}» en {antes[1]}")
                    rechazado = hubo_rechazo = True
                else:
                    vistos.unidades[nombre] = (unidad, hoja.archivo)

        if hoja.nombre == "Reactivos":
            aplica("color", n.color)
            aplica("hoja_seguridad", n.si_no)
            aplica("implica_peligro", n.si_no)
            for grado in ("riesgo_salud", "riesgo_reactividad",
                          "riesgo_inflamabilidad"):
                aplica(grado, n.grado_nfpa)
            aplica("peso_vacio", n.numero_opcional)
            aplica("peso_total", n.numero_opcional)

            try:
                campos["estado_fisico"] = n.estado_fisico(
                    crudo.get("solido"), crudo.get("liquido"),
                    crudo.get("gas")).dato
            except n.Rechazo as error:
                anota(fila, "solido", error.regla, "", "rechazo", error.detalle)
                rechazado = hubo_rechazo = True

            vacio, lleno = campos.get("peso_vacio"), campos.get("peso_total")
            if vacio is not None and lleno is not None and lleno <= vacio:
                anota(fila, "peso_vacio", R_PESO, f"{vacio} / {lleno}", "rechazo",
                      f"el peso lleno ({lleno}) no supera al vacío ({vacio})")
                rechazado = hubo_rechazo = True

        if hoja.nombre == "Equipos":
            aplica("funcionamiento", n.funcionamiento)
            aplica("numero_serie", n.texto)
            aplica("numero_inventario", n.numero_inventario)

            lab = campos.get("laboratorio")
            if lab and catalogos.laboratorios:
                validos = catalogos.laboratorios.get(hoja.almacen, set())
                if n.clave(lab) not in validos:
                    anota(fila, "laboratorio", R_LAB, lab, "rechazo",
                          f"«{lab}» no es un laboratorio de {hoja.almacen}")
                    rechazado = hubo_rechazo = True

            observaciones = campos.get("observaciones") or ""
            encontrado = VARIOS_EQUIPOS.search(observaciones)
            if encontrado and int(encontrado.group(1)) > 1:
                anota(fila, "observaciones", R_EQUIPO, observaciones, "rechazo",
                      "un renglón por equipo físico, con su serie y su inventario")
                rechazado = hubo_rechazo = True

            for campo, visto, regla in (("numero_serie", vistos.series, R_SERIE),
                                        ("numero_inventario",
                                         vistos.inventarios, R_INV)):
                valor = campos.get(campo)
                if valor is None:
                    continue
                if valor in visto:
                    archivo_previo, fila_previa = visto[valor]
                    # Las DOS filas del par se anotan. Con una serie duplicada
                    # no se sabe cuál de los dos equipos está mal rotulado, y
                    # quien corrija el archivo tiene que mirar las dos.
                    anota(fila, campo, regla, valor, "rechazo",
                          f"ya estaba en {archivo_previo} fila {fila_previa}")
                    anota(fila_previa, campo, regla, valor, "rechazo",
                          f"se repite en {hoja.archivo} fila {fila}")
                    rechazado = hubo_rechazo = True
                else:
                    visto[valor] = (hoja.archivo, fila)

        if not rechazado:
            salida.append(Renglon(fila=fila, campos=campos))

    return None if hubo_rechazo else tuple(salida)
