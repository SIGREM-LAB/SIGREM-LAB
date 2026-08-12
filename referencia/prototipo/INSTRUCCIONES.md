# SIGREM-LAB - Sistema Integral de Gestión de Reactivos, Materiales y Equipos de Laboratorio

## Universidad Autónoma del Estado de Hidalgo - Unidad Central de Laboratorios

---

## 📋 Descripción del Sistema

SIGREM-LAB es un sistema profesional de gestión de laboratorio diseñado específicamente para la UAEH. Permite administrar el inventario completo de reactivos, materiales y equipos, así como registrar el uso en prácticas de laboratorio y generar reportes estadísticos.

## 🎨 Identidad Visual

El sistema utiliza los colores institucionales de la UAEH:
- **Color Principal**: #C10230 (Guinda UAEH)
- **Color Secundario**: #ED5E17 (Naranja)
- **Color de Acento**: #FF8300 (Naranja claro)
- **Color de Alertas**: #A21A19 (Rojo oscuro)
- **Color Neutro**: #6F6F6E (Gris)
- **Fondos**: #F5F6F8 (Gris claro)

## 📱 Módulos del Sistema

### 1. **Menú Principal**
- Dashboard con acceso rápido a todos los módulos
- Indicadores del sistema:
  - Total de reactivos
  - Total de materiales
  - Total de equipos
  - Prácticas registradas

### 2. **Inventario**
Administración completa de elementos del laboratorio:

**Funcionalidades:**
- Buscador inteligente por nombre, código o marca
- Filtros por tipo de elemento
- Registro de nuevos elementos con generación automática de códigos
- Generación de códigos QR para cada elemento
- Gestión de existencias
- Estados: Disponible, Stock bajo, Agotado, Contaminado, Mantenimiento

**Tipos de elementos:**
- Reactivos líquidos
- Reactivos sólidos
- Materiales
- Equipos

**Información capturada:**
- Código (autogenerado: INV-0001, INV-0002, etc.)
- Nombre
- Marca
- Descripción
- Existencia inicial y actual
- Unidad de medida (ml, L, g, kg, piezas)
- Cantidad mínima
- Fecha de adquisición
- Fecha de caducidad (solo para reactivos)

### 3. **Prácticas**
**Módulo principal del sistema** - Todo el registro se realiza en una sola pantalla.

**Datos de la práctica:**
- Programa educativo (selección de 8 opciones)
- Laboratorio
- Asignatura
- Número de práctica (autogenerado: PRA-0001, PRA-0002, etc.)
- Fecha (automática, no editable)

**Métodos de control según tipo de elemento:**

1. **Reactivos (Peso):**
   - Peso inicial
   - Peso final
   - Consumo (calculado automáticamente)

2. **Materiales (Cantidad):**
   - Cantidad entregada
   - Cantidad devuelta
   - Cantidad dañada
   - Pérdidas (calculadas automáticamente)

3. **Equipos (Préstamo):**
   - Estado de salida
   - Estado de devolución
   - Observaciones

**Observaciones generales:**
- Checkboxes: No tenemos, Préstamo N4/N3/LUM, Contaminado, Se terminó, Material/Equipo dañado, Otro
- Campo de descripción adicional

**Funciones:**
- Escanear QR (simulado)
- Búsqueda manual por código
- Panel inteligente que muestra solo los campos necesarios según el tipo de elemento
- Actualización automática del inventario al guardar

### 4. **Reportes**
Sistema profesional de reportes para auditorías.

**Filtros disponibles:**
- Fecha inicio y fin
- Laboratorio
- Asignatura
- Tipo de elemento (General, Reactivos, Materiales, Equipos)

**Tabla de resultados:**
Muestra todos los registros con:
- Fecha
- Código del elemento
- Nombre del elemento
- Tipo
- Consumo o uso
- Número de práctica
- Laboratorio
- Asignatura

**Resumen estadístico:**
- Total de registros
- Número de prácticas
- Elementos únicos utilizados
- Laboratorios involucrados

**Exportación:**
- Exportar a Excel
- Exportar a PDF

## 🔧 Características Técnicas

- **Framework**: React con TypeScript
- **Enrutamiento**: React Router 7
- **Gestión de estado**: Zustand (con persistencia local)
- **Estilos**: Tailwind CSS v4 con colores institucionales UAEH
- **Generación QR**: qrcode.react
- **Notificaciones**: Sonner
- **Iconografía**: Lucide React

## 💾 Persistencia de Datos

El sistema utiliza almacenamiento local del navegador para mantener los datos:
- Inventario completo
- Historial de prácticas
- Los datos persisten entre sesiones

## 🎯 Casos de Uso Principales

### Agregar un elemento al inventario
1. Ir a **Inventario**
2. Click en "Nuevo elemento"
3. Llenar el formulario
4. Sistema genera código y QR automáticamente
5. Imprimir etiqueta (opcional)

### Registrar una práctica
1. Ir a **Prácticas**
2. Seleccionar programa educativo, laboratorio y asignatura
3. Escanear QR o buscar elementos manualmente
4. Para cada elemento, capturar datos según su tipo:
   - Reactivos: pesos
   - Materiales: cantidades
   - Equipos: estados
5. Agregar observaciones generales
6. Guardar práctica
7. Sistema actualiza inventario automáticamente

### Generar un reporte
1. Ir a **Reportes**
2. Aplicar filtros deseados
3. Revisar resultados y resumen estadístico
4. Exportar a Excel o PDF

## 📊 Datos de Ejemplo

El sistema incluye datos de ejemplo pre-cargados:
- 10 elementos de inventario (reactivos, materiales y equipos)
- Listo para empezar a usar inmediatamente

## 🚀 Ventajas del Sistema

✅ **Todo en una pantalla**: Registro completo de prácticas sin ventanas emergentes
✅ **Generación automática**: Códigos y números de práctica
✅ **Panel inteligente**: Muestra solo los campos necesarios
✅ **Actualización automática**: El inventario se actualiza al guardar prácticas
✅ **Diseño institucional**: Colores y estilo UAEH
✅ **Profesional**: Listo para auditorías y reportes formales
✅ **Rápido**: Diseñado para captura ágil en el laboratorio

## 📝 Notas Importantes

- El sistema NO incluye módulos de login, usuarios o configuración (según especificaciones)
- Diseñado específicamente para uso en desktop
- Enfocado en rapidez de captura y facilidad de uso
- Sin gráficas complejas, enfoque en datos tabulares
- Preparado para futura migración a JavaFX si es necesario

---

**Desarrollado para la Universidad Autónoma del Estado de Hidalgo**  
**Unidad Central de Laboratorios**  
**© 2026 UAEH**
