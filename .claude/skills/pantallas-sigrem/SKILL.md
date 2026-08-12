---
name: pantallas-sigrem
description: Use when writing or reviewing any React code in this repo - components, screens, forms, data fetching with TanStack Query, Supabase mutations, MUI layout, or the dynamic alta form driven by the formulario() function
---

# Pantallas SIGREM-LAB

Convenciones de interfaz para este repo. El stack ya está elegido y cada pieza
tiene dueño: **MUI 9** para componentes, **TanStack Query 5** para datos del
servidor, **react-hook-form 7 + zod 4** para formularios, **supabase-js 2**
tipado con `Database`. React 19, Vite, sin Next.js.

**Principio:** si estás escribiendo algo que una de esas librerías ya hace,
bórralo y usa la librería.

## Datos del servidor: siempre TanStack Query

`supabase-js` **no lanza excepciones**: devuelve `{ data, error }`. Si no
revisas `error` y lo lanzas, Query cree que todo salió bien y te deja `data` en
`null` sin marcar el estado de error. Es el error más común de este stack.

```tsx
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useExistencias(almacenId: number) {
  return useQuery({
    queryKey: ['existencias', almacenId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('existencia')
        .select('id, codigo, cantidad, estado, articulo(nombre_canonico, unidad_base)')
        .eq('almacen_id', almacenId)
        .order('codigo')
      if (error) throw error   // <- sin esta línea, los fallos son invisibles
      return data
    },
  })
}
```

`queryKey` lleva **todo** lo que cambia el resultado. Si el filtro por almacén
no está en la llave, cambiar de almacén devuelve la caché del anterior.

### Mutaciones: invalidar lo que quedó viejo

```tsx
const qc = useQueryClient()

const registrarConteo = useMutation({
  mutationFn: async (v: { existenciaId: number; contado: number; saldo: number }) => {
    const { error } = await supabase.from('movimiento').insert({
      existencia_id: v.existenciaId,
      tipo: 'ajuste_conteo',
      cantidad: v.contado - v.saldo,
      // almacen_id, cantidad_antes y cantidad_despues los escribe el trigger.
      // Mandarlos desde el cliente no sirve: los sobrescribe.
    })
    if (error) throw error
  },
  onSuccess: () => qc.invalidateQueries({ queryKey: ['existencias'] }),
})
```

Nunca escribas `existencia.cantidad` directo. El saldo lo mantiene el trigger a
partir de `movimiento`; escribirlo a mano rompe la bitácora de auditoría.

## Formularios: react-hook-form + zod, nunca useState por campo

```tsx
const esquema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  cantidad: z.number().nonnegative('No puede ser negativa'),
})
type Valores = z.infer<typeof esquema>

const { control, handleSubmit } = useForm<Valores>({ resolver: zodResolver(esquema) })

<Controller
  name="cantidad"
  control={control}
  render={({ field, fieldState }) => (
    <TextField
      {...field}
      label="Cantidad"
      type="number"
      error={!!fieldState.error}
      helperText={fieldState.error?.message}
    />
  )}
/>
```

Los mensajes de error se escriben en el esquema de zod, no en el JSX.

## El formulario de alta se arma desde la base

Cada almacén captura distinto: N3 y LUM piden los dos pesos del frasco, N4 no.
Esa diferencia vive en la tabla de perfiles, y `formulario()` la devuelve ya
resuelta.

```tsx
const { data: campos } = useQuery({
  queryKey: ['formulario', almacenId, clasificacion],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('formulario', {
      p_almacen: almacenId,
      p_clasificacion: clasificacion,
    })
    if (error) throw error
    return data
  },
})
```

Cada campo trae `campo`, `etiqueta`, `tipo_dato`, `destino`, `opciones`,
`obligatorio` y `orden`. El esquema de zod se construye recorriendo esa lista,
y el control se elige por `tipo_dato`: `texto` → `TextField`, `numero` →
`TextField type="number"`, `fecha` → date input, `booleano` → `Checkbox`,
`seleccion` → `Select` con `opciones`.

**Arma el payload recorriendo `campos`, nunca leyendo el DOM ni un objeto de
estado más grande.** Esa es la propiedad que hace que un campo fuera del perfil
sencillamente no exista en el envío. Si el payload sale de otro lado, un campo
oculto se puede colar — que es exactamente el problema que los perfiles vienen
a resolver.

## MUI

**`Grid` usa `size`.** En MUI 9 no existen `item` ni `xs` sueltos:

```tsx
<Grid container spacing={2}>
  <Grid size={{ xs: 12, md: 6 }}>…</Grid>
</Grid>
```

**Las props de sistema van en `sx`, no sueltas.** MUI 9 dejó de aceptarlas
directamente en `Stack`, `Typography` y compañía. Truena en compilación, no en
tiempo de ejecución, pero es lo primero que se escribe por costumbre:

```tsx
// ✗ No compila en MUI 9
<Stack alignItems="center" py={6}>
<Typography color="text.secondary" textAlign="center">

// ✓
<Stack sx={{ alignItems: 'center', py: 6 }}>
<Typography sx={{ color: 'text.secondary', textAlign: 'center' }}>
```

`spacing` y `direction` sí siguen siendo props propias de `Stack`.

**Colores desde el tema, nunca hex en el componente.** La paleta institucional
(guinda `#C10230`) se define una vez en el tema y se usa como
`color="primary"` o `sx={{ color: 'primary.main' }}`. Un hex suelto en un
componente no se puede cambiar de golpe ni responde al modo oscuro.

**`sx` para ajustes puntuales; el tema para lo que se repite.** Si el mismo
`sx` aparece tres veces, es una variante del tema o un componente propio.

**Iconos con `@iconify/react`**, que ya está instalado:

```tsx
import { Icon } from '@iconify/react'
<Icon icon="mdi:flask-outline" />
```

## Lo que NO se escribe a mano

| Si te encuentras escribiendo | Usa |
|---|---|
| Una tabla con `<table>` y ordenamiento | `Table` de MUI |
| Un modal con `position: fixed` | `Dialog` |
| Un dropdown con `useState(abierto)` | `Select` o `Menu` |
| `useEffect` + `useState` + `fetch` | `useQuery` |
| Un `useState` por cada campo | `useForm` |
| `if (!valor) setError('requerido')` | esquema de zod |
| Un spinner y un flag `cargando` | `isPending` de Query |
| Un toast propio | `Snackbar` |

## Errores comunes

| Error | Consecuencia |
|---|---|
| No lanzar el `error` de supabase | Query nunca entra en estado de error; la pantalla se queda en blanco sin explicación |
| `queryKey` sin las variables del filtro | Se muestra la caché del almacén anterior |
| Mandar `almacen_id` en un `movimiento` | Se ignora: lo impone el trigger desde la existencia |
| Escribir `existencia.cantidad` directo | Rompe la bitácora; el saldo deja de cuadrar con los movimientos |
| `<Grid item xs={12}>` | API vieja: en MUI 9 es `<Grid size={{ xs: 12 }}>` |
| Condicionales por almacén en el formulario | Los perfiles existen justo para eso; agregar un almacén obligaría a redesplegar |
| Editar `src/types/database.ts` | Se sobreescribe en el siguiente `pnpm gen:types` |

## Al entregar una pantalla

Toda entrega de interfaz tiene exactamente tres partes, en este orden:

**1. Qué se construyó.** Una o dos líneas.

**2. Verificación automática.** La salida real de los comandos, no la promesa:

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

**3. Guion de prueba manual.** Pasos numerados. Cada paso dice qué hacer y qué
debería pasar, para que se pueda seguir sin conocer el código:

```
1. `pnpm dev` y entra como n3@uaeh.local / sigrem2026
   -> Cae en el inventario de N3, y la cabecera dice "Laboratorio N3"
2. Cambia el filtro de almacén a N4
   -> Ves sus existencias, pero el botón de editar aparece deshabilitado
3. Recarga la página con F5
   -> Sigues dentro, sin pasar por el login ni ver un parpadeo
```

El guion cubre lo que las pruebas automáticas no alcanzan. En este proyecto,
casi siempre:

| Zona | Qué comprobar a mano |
|---|---|
| RLS con usuarios reales | Entrar como responsable de un almacén y confirmar que no puede escribir en otro |
| Formulario dinámico | Que N3 pida los dos pesos del frasco y N4 no |
| Sesión | Recargar con F5 y seguir dentro; cerrar sesión y no poder volver con el botón atrás |
| Errores | Apagar el stack (`supabase stop`) y ver que sale un mensaje entendible, no una pantalla en blanco |
| Teclado | Recorrer el formulario con Tab y enviarlo con Enter |
| Pantalla chica | Reducir a ~1024 px, que es la resolución de las máquinas del almacén |

Si una parte no aplica, dilo explícitamente en vez de omitirla.
