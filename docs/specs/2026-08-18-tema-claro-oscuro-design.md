# Tema claro y oscuro

**Fecha:** 18 de agosto de 2026
**Estado:** disenio aprobado, pendiente de plan de implementacion
**MUI:** 9.3.1. La API de `colorSchemes` se verifico leyendo los `.d.ts` del
paquete instalado, no de memoria: cambio entre v5, v6 y v7.

---

## 1 · Por que, y contra que va

Hoy el tema tiene una sola paleta y dos lineas que apagan el modo oscuro a
proposito:

```
src/tema.ts:34    ':root': { colorScheme: 'light' }
index.html:9      <meta name="color-scheme" content="light">
```

Las dos llevan el mismo comentario: *"El sistema operativo de los almacenes
suele estar en modo oscuro. Sin esto el navegador pinta en oscuro lo que dibuja
el, no MUI: barras de scroll, campos autocompletados y menus nativos. Eso fue
la pantalla negra."*

Ese comentario describe un incidente real y **este disenio lo tiene que
respetar**. La diferencia es que en su momento no habia una alternativa: se
forzo claro porque no existia una paleta oscura que ofrecer. Ahora si va a
existir, asi que esas dos lineas no se borran — **se sustituyen** por
declaraciones que conocen los dos modos. Si al implementar resulta que MUI no
emite el `color-scheme` correcto por esquema, el trabajo no esta hecho: no se
cierra el hito hasta comprobarlo en el CSS generado, no en la documentacion.

Lo que abarata todo esto: la regla "colores desde el tema, nunca hex en el
componente" se respeto. Fuera de `tema.ts` y `almacenes.ts` hay 21 literales de
color en todo `src/`, y 9 son `rgba(255,255,255,x)` sobre el guinda de la barra.

## 2 · Decisiones tomadas

| # | Decision | Por que |
|---|---|---|
| D1 | El modo sigue al sistema operativo, y el usuario puede forzar claro u oscuro. Tres estados: `system` / `light` / `dark` | Es lo que la gente espera. `useColorScheme()` de MUI ya devuelve exactamente esos tres |
| D2 | La barra lateral y la cabecera del login siguen guinda `#C10230` en los dos modos | La identidad no parpadea al cambiar de tema. Ademas deja intactos los 9 `rgba` blancos de `Layout.tsx` |
| D3 | La preferencia se guarda en `localStorage`, no en la base | Las maquinas de los almacenes son compartidas: la preferencia es del equipo. Cuesta cero migraciones y funciona antes de iniciar sesion |
| D4 | El control va en la barra lateral y en el login | El login es una pantalla completa donde alguien se puede quedar un rato |
| D5 | Un token `institucional` para los rellenos de marca, separado de `primary` | Ver §3. Sin esto, `color="primary"` sobre texto es una trampa en oscuro |
| D6 | Los botones de accion primaria son guinda en los dos modos | Decision explicita del usuario. Se implementa como default del tema, no boton por boton (§3) |
| D7 | El caption blanco de la barra sube de `0.75` a `0.82` de opacidad | Arreglo de accesibilidad: hoy da 3.95:1 y WCAG pide 4.5:1 para 12 px. Afecta tambien al modo claro |
| D8 | Se usa la API `colorSchemes` de MUI, no un contexto propio | Persistencia, deteccion del SO y script anti-destello ya vienen resueltos en el paquete instalado |

## 3 · El sistema de color: `institucional` contra `primary`

Este es el punto que decide si el disenio se sostiene, y el mas facil de
arruinar.

**El guinda hace dos trabajos distintos**, y en oscuro se pelean:

1. **Como relleno** — fondo de la barra, cabecera del login, boton "Entrar".
   Aqui el contraste es interno: blanco sobre `#C10230` da 6.33:1 y eso no
   depende de lo que haya detras. Funciona igual en claro y en oscuro.
2. **Como tinta** — `color: 'primary.main'` en el encabezado "Iniciar sesion".
   Aqui el contraste es contra la superficie. Sobre papel oscuro `#1E2126`,
   el guinda `#C10230` da **2.55:1**. Ilegible.

Un solo token no puede cumplir los dos trabajos. La salida es separarlos:

| Token | Valor | Cambia con el modo | Para que |
|---|---|---|---|
| `institucional` | `#C10230`, texto blanco | No | Rellenos de marca: barra, cabecera del login, botones de accion primaria |
| `primary` | `#C10230` claro / `#E85C76` oscuro | Si | El guinda como tinta sobre la pagina: encabezados, enlaces, foco, estado seleccionado |

**Por que un token nuevo y no parchar los dos sitios que fallan hoy.** Porque
hoy fallan dos, pero `Inventario`, `Practicas`, `Reportes` e
`Inventario general` todavia no existen. Cualquier `color="primary"` que se
escriba ahi sobre texto va a salir a 2.55:1 en oscuro y nadie lo va a notar
hasta que alguien lo reporte. El token cierra la trampa antes de que exista.

**Consecuencia de D6.** Como los botones de accion primaria son guinda siempre,
`institucional` se declara como color por defecto de `MuiButton` en el tema, no
se marca boton por boton:

```ts
MuiButton: { defaultProps: { disableElevation: true, color: 'institucional' } }
```

Asi el "Entrar" del login y cualquier boton futuro salen guinda sin que nadie
se acuerde de la regla. El "Cerrar sesion" de la barra no se ve afectado: ya
fija sus propios colores en `sx`.

`institucional` es un color de paleta propio, asi que necesita aumentacion de
modulo de TypeScript para que `Button` lo acepte en `color`:

```ts
declare module '@mui/material/styles' {
  interface Palette { institucional: Palette['primary'] }
  interface PaletteOptions { institucional?: PaletteOptions['primary'] }
}
declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides { institucional: true }
}
```

Esto no contradice la regla "los tipos se generan, no se escriben": esa regla
es sobre `src/types/database.ts` y el esquema de Postgres. La aumentacion de
modulo de MUI es la forma documentada de declarar un color de paleta propio.

## 4 · La paleta

Todos los contrastes de abajo estan calculados con la formula de WCAG 2.1
(luminancia relativa), no estimados a ojo.

| Token | Claro | Oscuro | Contraste en oscuro |
|---|---|---|---|
| `background.default` | `#F5F6F8` | `#16181C` | — |
| `background.paper` | `#FFFFFF` | `#1E2126` | — |
| `text.primary` | `#202226` | `#E8EAED` | 13.39:1 sobre papel |
| `text.secondary` | `#6F6F6E` | `#A2A5AB` | 6.54:1 sobre papel |
| `primary.main` | `#C10230` | `#E85C76` | 4.78:1 sobre papel |
| `secondary.main` | `#ED5E17` | `#FF8300` | 6.53:1 sobre papel |
| `error.main` | `#A21A19` | `#F2635F` | 5.17:1 sobre papel |
| `divider` | `#E4E6EA` | `#2C3037` | — |
| `grey.600` | `#6F6F6E` | `#A2A5AB` | — |
| `institucional.main` | `#C10230` | `#C10230` | 6.33:1 (blanco encima) |

Dos criterios detras de estos valores:

**Ni negro puro ni blanco puro.** `#16181C` y `#E8EAED` conservan el mismo
sesgo frio que ya tiene la paleta clara (`#F5F6F8` y `#202226` tambien tiran
levemente a azul). Blanco puro sobre negro puro produce halo y cansa la vista
en jornadas largas, que es justo el caso de uso.

**El guinda aclarado hay que desaturarlo.** Subir la luminosidad de `#C10230`
manteniendo su saturacion del 98% da `#FD3565`, que es neon y no se parece al
color institucional. `#E85C76` baja saturacion al aclarar y sigue leyendose
como guinda.

`background.paper` es mas claro que `background.default` en los dos modos, igual
que hoy: las superficies elevadas se acercan al usuario.

## 5 · Mecanica

### 5.1 El tema

`src/tema.ts` pasa de una paleta a dos esquemas. **La tipografia, `shape` y los
diez overrides de `components` no se tocan**: no dependen del color.

```ts
export const tema = createTheme({
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
  colorSchemes: {
    light: { palette: { /* la paleta de hoy, mas institucional */ } },
    dark:  { palette: { /* §4, mas institucional */ } },
  },
  shape: { /* igual */ },
  typography: { /* igual */ },
  components: { /* igual, con el defaultProps de MuiButton de §3 */ },
})
```

Del `MuiCssBaseline` sale `':root': { colorScheme: 'light' }`. Lo sustituye el
`color-scheme` que MUI emite por esquema al usar `cssVariables`. La linea
`body: { WebkitFontSmoothing: 'antialiased' }` se queda.

### 5.2 El destello inicial

Esta app es Vite en cliente puro: no hay render en servidor. El componente
`InitColorSchemeScript` de MUI esta pensado para frameworks con SSR, donde el
script sale ya en el HTML. Aqui React monta despues de que el navegador parsea
el documento, asi que renderizarlo desde React no llega a tiempo: la primera
pintura saldria en claro y saltaria a oscuro.

La solucion es un script en linea en `index.html`, antes del bundle, que lea
`localStorage` y ponga el atributo en `<html>`. Son unas seis lineas y usan las
claves que el propio paquete documenta en su `defaultConfig`, verificadas en
`node_modules/@mui/material/InitColorSchemeScript/InitColorSchemeScript.d.ts`:

| Clave | Valor |
|---|---|
| atributo | `data-mui-color-scheme` |
| modo en localStorage | `mui-mode` |
| esquema en localStorage | `mui-color-scheme` |

Escribir esas seis lineas no contradice la regla principal de CLAUDE.md: no hay
nada en el paquete que resuelva el caso cliente-puro. Si al implementar aparece
una via de primera parte que si lo cubra, se usa esa.

`index.html` ademas cambia `<meta name="color-scheme" content="light">` por
`content="light dark"`.

### 5.3 El control

`src/app/BotonTema.tsx`, un `IconButton` que cicla los tres estados con
`useColorScheme()`:

```
system -> light -> dark -> system
```

Iconos de `@iconify/react`, que ya esta instalado: `mdi:theme-light-dark`
(automatico), `mdi:weather-sunny` (claro), `mdi:weather-night` (oscuro).

El estado actual se anuncia con `aria-label`, no solo con el icono: "Tema:
automatico", "Tema: claro", "Tema: oscuro". Un icono sin nombre accesible no le
dice nada a un lector de pantalla, y este control no tiene texto visible.

`useColorScheme()` devuelve `colorScheme: undefined` en el primer render
(documentado en el `.d.ts`: *"It is always `undefined` on the server"*, y en
cliente hasta que monta). El boton tiene que tolerarlo sin parpadear ni tronar.

Colocacion:
- **Barra lateral**: en el pie, junto a "Cerrar sesion".
- **Login**: arriba a la derecha de la tarjeta, fuera del `Paper`.

## 6 · Lo que cae por arrastre

| Archivo | Que | Por que |
|---|---|---|
| `Layout.tsx` | `bgcolor: 'primary.main'` -> `'institucional.main'` | D2: la barra no cambia con el modo |
| `Layout.tsx` | los dos `rgba(255,255,255,0.75)` -> `0.82` | D7 |
| `PantallaAcceso.tsx` | cabecera `bgcolor: 'primary.main'` -> `'institucional.main'` | D2 |
| `PantallaAcceso.tsx:57` | `color="#6F6F6E"` fijo en los iconos de campo -> `text.secondary` | Se pierde sobre superficie oscura |
| `PantallaAcceso.tsx:165` | `color: 'primary.main'` en "Iniciar sesion" | Se queda: ahora `primary` si se adapta |
| `PantallaAcceso.tsx` | el lockup del pie: `<LogoUAEH … blanco={colorScheme === 'dark'} />` | El logo a color sobre `#16181C` no contrasta. `LogoUAEH` ya tiene la prop `blanco`: no cambia su API |

Sobre ese ultimo: se compara contra `colorScheme`, **no** contra `mode`. `mode`
vale `'system'` cuando el usuario no ha forzado nada, asi que `mode === 'dark'`
daria falso justo en el caso mas comun de todos — sistema en oscuro y
preferencia en automatico. `colorScheme` es el esquema ya resuelto. Vale
`undefined` en el primer render (§5.3), y ahi `blanco` sale `false`, que es el
lado seguro: el logo a color sobre fondo claro.
| `arranque.ts` | agregar `background` explicito junto al `color` que ya tiene | §8 |

**Lo que no se toca:** los 9 `rgba(255,255,255,x)` restantes de `Layout.tsx`
siguen siendo validos porque la barra sigue guinda (D2). `almacenes.ts` tampoco:
sus 4 hex son datos de cada almacen, no paleta de interfaz, y su propio
comentario ya lo explica.

## 7 · Riesgos

| Riesgo | Como se cierra |
|---|---|
| La pantalla negra vuelve por otro lado (scroll, autocompletado, menus nativos) | No se cierra leyendo documentacion: se verifica en el CSS generado que MUI emite `color-scheme` por esquema, y se prueba a mano con el SO en oscuro |
| `arranque.ts` corre fuera de React, sin tema | Fondo explicito ademas del color. Es la pantalla que existe para explicar fallos: no puede ser la que falle |
| Destello en la primera pintura | §5.2 |
| El punto de color del almacen N3 es `#C10230` sobre barra `#C10230`: invisible | **Preexistente y fuera de alcance.** Reportado, no se arregla aqui |

## 8 · Pruebas

**Automaticas** (`vitest`, como el resto del repo):

| Que | Donde |
|---|---|
| `BotonTema` cicla `system -> light -> dark -> system` | `src/app/BotonTema.test.tsx` |
| `BotonTema` anuncia el estado actual en su `aria-label` | idem |
| `BotonTema` no truena cuando `colorScheme` llega `undefined` | idem |
| Los dos esquemas definen los mismos tokens (ninguno se queda sin `text.secondary`, sin `divider`, etc.) | `src/tema.test.ts` |
| Los pares de texto sobre superficie alcanzan 4.5:1, calculado en la prueba | `src/tema.test.ts` |

Esa ultima es la que da valor real: convierte la tabla de §4 en algo que se
rompe solo si alguien mete un color que no contrasta. Los pares que cubre son
exactamente estos ocho, en los dos esquemas:

```
text.primary   sobre background.default   text.primary   sobre background.paper
text.secondary sobre background.default   text.secondary sobre background.paper
primary.main   sobre background.paper     error.main     sobre background.paper
secondary.main sobre background.paper     institucional.contrastText sobre institucional.main
```

`divider` y los dos `background` no entran: no son texto y no les aplica el
umbral de 4.5:1.

**A mano** — lo que las pruebas no alcanzan:

1. Poner Windows en modo oscuro y abrir la app sin preferencia guardada
   -> arranca en oscuro, sin destello claro previo.
2. Forzar claro con el boton, recargar con F5
   -> sigue en claro. La preferencia sobrevive.
3. Con el stack apagado (`supabase stop`), recargar
   -> la pantalla de `arranque.ts` se lee en los dos modos del SO.
4. Cambiar el modo del SO con la app abierta y el boton en automatico
   -> la app cambia sola.
5. Entrar como `n3@` en oscuro
   -> la barra sigue guinda; el logo del pie del login se ve en blanco, no
   apagado sobre el fondo oscuro.
6. Recorrer el login con Tab en los dos modos
   -> el anillo de foco se ve en ambos.

## 9 · Fuera de alcance

- Guardar la preferencia por usuario en la base (D3 la deja en el equipo).
- Un tercer tema de alto contraste.
- El punto invisible del almacen N3 (§7).
- Reemplazar la sombra de la tarjeta del login por un borde en oscuro. Una
  sombra oscura sobre fondo oscuro no se ve, pero tampoco molesta; si al
  probarlo la tarjeta se pierde contra el fondo, se abre aparte.

## 10 · Resumen del cambio

**Archivos nuevos:** `src/app/BotonTema.tsx`, `src/app/BotonTema.test.tsx`,
`src/tema.test.ts`.

**Archivos modificados:** `src/tema.ts` (el grueso), `src/App.tsx`,
`index.html`, `src/app/Layout.tsx`, `src/features/auth/PantallaAcceso.tsx`,
`src/arranque.ts`.

**Migraciones:** ninguna. **Dependencias nuevas:** ninguna.
