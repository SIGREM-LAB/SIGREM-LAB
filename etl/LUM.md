# Inventarios de LUM → Supabase remoto

1. Conserva el Excel original sin modificar. Puedes dejarlo en
   `etl/Datos-Reales-JD2026/original/Almacén-LUM/`.
2. Copia `.env.remoto.example` a `.env.remoto` y configura la conexión
   PostgreSQL remota y el correo del usuario que firmará la carga.
   Las credenciales del frontend no sirven para esta importación.
3. Valida contra los catálogos remotos:

   ```powershell
   python -m etl.cargar_lum "ruta/al/inventario.xlsx"
   ```

4. Revisa el CSV generado en `etl/review/`. Después carga:

   ```powershell
   python -m etl.cargar_lum "ruta/al/inventario.xlsx" --cargar
   ```

Por omisión se procesa Reactivos; para los equipos agrega `--hoja Equipos`.
Se pasa siempre la ruta de `etl/Datos-Reales-JD2026/corregido/`, que genera
`python -m etl.corregir`. Cada renglón válido representa una existencia; los rechazados quedan en carga_pendiente.
La escritura y el cuadre se ejecutan en una transacción. Un error revierte
esa carga. El importador existente bloquea repetir el mismo archivo y hoja;
no cambies el nombre del archivo para intentar repetir una importación.
No se borra inventario previo.
