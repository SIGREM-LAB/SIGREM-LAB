"""El CSV de excepciones: qué no se pudo cargar, y qué se corrigió solo.

Dos clases de problema, y la diferencia decide si la hoja entra o no:

  rechazo      el renglón viola una regla y no se puede adivinar la intención.
               La hoja NO se carga.
  normalizado  el ETL sabe qué hacer sin preguntar. La hoja SÍ se carga.

La columna `accion` es comparable renglón a renglón con la columna «Espera» de
`etl/ejemplos/DEFECTOS.md`, que es lo que hace posible la prueba de aceptación.
"""

from __future__ import annotations

import csv
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Literal

Accion = Literal["rechazo", "normalizado"]

COLUMNAS = ("archivo", "hoja", "fila", "columna", "regla", "valor",
            "accion", "detalle")


@dataclass(frozen=True)
class Problema:
    archivo: str
    hoja: str
    fila: int | None      # fila de Excel, para poder ir a verla. None = toda la hoja
    columna: str          # letra de columna, o "" si el problema no es de una celda
    regla: str
    valor: Any
    accion: Accion
    detalle: str


class Informe:
    def __init__(self) -> None:
        self._problemas: list[Problema] = []

    def anotar(self, problema: Problema) -> None:
        self._problemas.append(problema)

    @property
    def problemas(self) -> list[Problema]:
        return list(self._problemas)

    @property
    def rechazos(self) -> list[Problema]:
        return [p for p in self._problemas if p.accion == "rechazo"]

    @property
    def normalizados(self) -> list[Problema]:
        return [p for p in self._problemas if p.accion == "normalizado"]

    @property
    def archivos_rechazados(self) -> set[str]:
        return {p.archivo for p in self.rechazos}

    def a_csv(self, ruta: Path) -> Path:
        ruta.parent.mkdir(parents=True, exist_ok=True)
        # utf-8-sig: sin el BOM, Excel abre el CSV en la codificación del
        # sistema y los acentos salen rotos. Este archivo lo va a abrir gente.
        with ruta.open("w", encoding="utf-8-sig", newline="") as f:
            escritor = csv.DictWriter(f, fieldnames=COLUMNAS)
            escritor.writeheader()
            for p in self._problemas:
                escritor.writerow(asdict(p))
        return ruta

    def __len__(self) -> int:
        return len(self._problemas)
