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

## Antes de decir que está listo

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Los tres en cero.
