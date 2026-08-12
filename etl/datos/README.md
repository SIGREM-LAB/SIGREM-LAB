# Datos de origen

Esta carpeta esta **vacia a proposito**. Los Excel de los almacenes no viven en git.

## Por que

1. Son binarios: git guarda una copia completa de cada version y no puede hacer diff de un `.xlsx`.
2. Son datos institucionales reales de la UCL-UAEH. Los repositorios escolares tienden a
   volverse publicos; el inventario de reactivos de la universidad no debe viajar en ese paquete.

## De donde salen

Los 10 archivos originales estan en el OneDrive del equipo, carpeta `Inventarios/`.
Copialos aqui (o apunta `ETL_DATOS_DIR` en tu `.env` a donde los tengas).

## Verificar que tienes la version correcta

`manifest.csv` (en esta carpeta, ese si commiteado) lleva nombre, tamano y SHA256 de cada
archivo de origen. Antes de correr la migracion:

```powershell
Import-Csv etl\datos\manifest.csv | ForEach-Object {
  $p = Join-Path $env:ETL_DATOS_DIR $_.Name
  $h = (Get-FileHash $p -Algorithm SHA256).Hash
  if ($h -ne $_.Hash) { "DIFIERE: $($_.Name)" } else { "ok: $($_.Name)" }
}
```

Si algo difiere, alguien actualizo un Excel. Averigua que cambio **antes** de migrar:
los archivos de reactivos invierten el orden de las columnas de cantidad entre almacenes,
y un cambio ahi produce cantidades erroneas sin lanzar ningun error.
