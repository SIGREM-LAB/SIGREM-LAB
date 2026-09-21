# Diseño · Que la balanza funcione en la máquina del almacén

**21 de septiembre de 2026**

Antecedente directo: el módulo de balanza que entró el 21 de septiembre de 2026
(`src/features/balanza/`), que lee el peso de una Optika por RS232 con Web
Serial. Aquel trabajo resolvió *leer la balanza*. Este resuelve el paso anterior,
que hasta ahora no tenía dueño: **que el sistema operativo de la máquina del
almacén vea el adaptador USB-serie como un puerto COM**.

No toca la base ni las políticas de RLS.

---

## 1 · Qué se decide aquí

Qué pasa cuando el responsable de un almacén enchufa el adaptador de la balanza
en una computadora donde nunca se instaló el driver de FTDI, pulsa «Conectar
balanza» y no ocurre nada.

Cubre: dónde vive el instalador del driver y cómo llega a esa máquina, cómo
clasifica la app el fallo, el diálogo que la guía, y el filtro que hace que el
selector de puertos de Chrome muestre una sola cosa.

Lo que **no** cubre: el empaquetado de la app como aplicación de escritorio.
Hoy se sirve desde Vercel y se abre en Chrome, y este diseño asume que eso
sigue siendo así. La §10 anota qué cambiaría si algún día deja de serlo.

---

## 2 · El punto de partida

Al enchufar el adaptador en una máquina sin preparar, Windows lo registra como
**«Dispositivo desconocido»**: no hay puerto COM. Instalar el paquete CDM de
FTDI lo resuelve y el adaptador levanta su COM, que es como se capturaron las
tramas reales de `balanza.test.ts`.

Del lado de la app, ese estado se ve así: `navigator.serial.getPorts()` devuelve
una lista vacía, y `requestPort()` abre un selector sin nada que elegir. Cuando
la persona lo cierra, la promesa se rechaza y `BarraBalanza` acaba pintando

> No se pudo abrir la balanza

que no le dice a nadie qué hacer. Y quien va a leer ese mensaje no es quien
escribió el código: es el responsable del almacén, solo, que no va a abrir el
Administrador de dispositivos.

El repositorio ya trae el driver en `drivers/ftdi-vcp/` —se subió el 21 de
septiembre— pero ahí no le sirve a nadie: Vite no publica esa carpeta, así que
desde la máquina del almacén esos 10.8 MB son inalcanzables.

---

## 3 · Los dos límites que no se negocian

Todo el diseño sale de aquí, así que conviene dejarlo escrito antes de las
decisiones.

**Ninguna página web puede instalar un driver de Windows.** No es una carencia
de Web Serial, es el modelo de seguridad del navegador. «Plug and play», para
una app que vive en una pestaña, solo puede significar dos cosas: que el fallo
sea imposible de malinterpretar, y que el arreglo sea un doble clic.

**La app tampoco puede detectar que falta el driver.** Web Serial enumera
puertos serie; un dispositivo sin driver no es un puerto, así que es invisible.
WebUSB tampoco lo alcanza: en Windows exige que el dispositivo ya tenga un
driver WinUSB enlazado, que es justo lo que no hay. Lo único que la app sabe es
**«no apareció ningún puerto»**, y eso lo causa tanto un driver ausente como un
cable desenchufado.

De ese segundo límite sale la regla de tono de todo el diálogo: no diagnostica,
guía.

---

## 4 · Decisiones

### D1 · La app guía; el instalador lo ejecuta la persona

Se descarta cualquier variante de instalación automática o silenciosa disparada
desde la app, porque es imposible (§3). Lo que sí se puede hacer es quitar del
camino todo lo demás: que el archivo correcto esté a un clic, que los pasos
estén escritos con el nombre exacto de los cuadros de diálogo que Windows va a
enseñar, y que reintentar no exija recargar la página.

### D2 · El ejecutable viaja con la app, servido desde `public/`

`public/drivers/CDM2123620_Setup.exe`, que Vercel publica en
`/drivers/CDM2123620_Setup.exe`.

Se sirve el **ejecutable** y no la carpeta de `.inf`/`.sys` porque son dos
experiencias distintas: el ejecutable mete el driver en el almacén de drivers de
Windows y a partir de ahí cualquier adaptador FTDI que se enchufe levanta su COM
solo, para siempre y en cualquier puerto USB. La carpeta suelta obliga a
«Actualizar controlador → Buscar en mi PC», que es exactamente la clase de paso
que esta persona no va a completar.

Está firmado con certificado **EV de Future Technology Devices International
Ltd**, válido hasta el 27 de marzo de 2027 (comprobado con
`Get-AuthenticodeSignature`). Importa porque una firma EV es lo que evita que
SmartScreen lo bloquee y lo que reduce el aviso de Chrome al descargarlo. Un
`.exe` sin firmar habría hecho inviable esta decisión.

No se enlaza al sitio de FTDI: obligaría a elegir entre varias descargas en una
tabla en inglés. El archivo que sirve la app es uno solo y es el correcto.

### D3 · La ayuda es un diálogo, no una ruta

La balanza se usa desde dos sitios —`BarraBalanza` en el panel de prácticas y
`BotonBalanza` en un campo suelto— y en los dos casos se está a mitad de una
captura. Una ruta propia obligaría a salir y volver, con el riesgo de perder lo
tecleado. Un `Dialog` de MUI se abre encima y devuelve a donde estabas.

Tampoco es enlazable, y no hace falta que lo sea: nadie va a mandar «ve a
preparar tu balanza» por correo.

### D4 · No se diagnostica; se guía en orden de probabilidad

El diálogo no dice «falta el driver», porque la app no lo sabe (§3). Dice que no
apareció ninguna balanza y ordena los pasos por probabilidad: primero el cable,
después el driver. Ese orden también es el correcto como diagnóstico, así que no
se paga nada por ser honesto.

### D5 · El selector de Chrome se filtra por fabricante

`requestPort({ filters: [{ usbVendorId: 0x0403 }] })` hace que el selector liste
solo el adaptador FTDI en vez de todos los COM de la máquina. Es el segundo
punto donde una persona no técnica se atasca: hoy el selector puede ofrecer tres
renglones indistinguibles.

El mismo filtro arregla un fallo real que ya existe. Hoy `conectar()` toma
`getPorts()[0]`, el primer puerto que el perfil de Chrome haya autorizado alguna
vez: si alguien autorizó un Arduino en esa máquina, la app lo abre en silencio y
se queda esperando tramas que no llegan.

El filtro esconde cualquier adaptador que no sea FTDI. Se asume a propósito
—todos los almacenes usan el mismo— y se deja una salida explícita en el
diálogo, «mi adaptador no es FTDI», que reintenta sin filtro.

### D6 · Se borran los `.zip`; se conserva la carpeta descomprimida

`drivers/ftdi-vcp/` pesa hoy 10.8 MB porque cada paquete está dos veces: el
`.zip` y su contenido ya extraído al lado. Se comprobó archivo por archivo que
los 24 del interior de los dos `.zip` son byte a byte idénticos a los de fuera.
Borrarlos deja 4.5 MB sin perder nada.

Se conserva `CDM-v2.12.36.20-WHQL-Certified/` como respaldo manual para la
máquina rara donde el ejecutable falle, y porque una descarga de un sitio ajeno
no es un plan a diez años. Se añade `drivers/LEEME.md`: hoy son 26 binarios sin
una línea de contexto en un repositorio público, y un `.sys` sin explicación en
un repo escolar es justo lo que hace desconfiar a quien lo clona.

---

## 5 · La clasificación del fallo

Hoy `conectar()` deja escapar el error crudo de Web Serial y cada pantalla lo
pinta como puede. Para que el diálogo salga solo cuando toca, el transporte pasa
a traducir el fallo a un caso nombrado.

```ts
export type FalloBalanza =
  /** No apareció ningún puerto: ni driver, ni cable, no se sabe. */
  | 'sin-puerto'
  /** Firefox, Safari, móvil: no hay Web Serial. */
  | 'no-soportado'
  /** El puerto lo tiene otra pestaña o el software de la balanza. */
  | 'ocupado'
  | 'desconocido'

export class ErrorBalanza extends Error {
  constructor(
    readonly caso: FalloBalanza,
    mensaje: string,
  ) {
    super(mensaje)
  }
}
```

El mapeo, en `crearTransporteWebSerial.conectar()`:

| Lo que ocurre | Caso |
|---|---|
| `navigator.serial === undefined` | `no-soportado` |
| `requestPort()` rechaza con `NotFoundError` | `sin-puerto` |
| `port.open()` rechaza con `InvalidStateError` o `NetworkError` | `ocupado` |
| Cualquier otra cosa | `desconocido` |

`NotFoundError` es lo que Web Serial lanza cuando el selector se cierra sin
elegir, y eso incluye el caso en que no había nada que elegir. Los dos llevan al
mismo sitio, que es lo que queremos: si la persona abrió el selector y lo cerró,
o no vio su balanza o no había ninguna.

`ValorBalanza` cambia en dos puntos: gana un campo para que la pantalla sepa qué
pasó sin leer cadenas, y `conectar` acepta saltarse el filtro de fabricante
(D5).

```ts
export type ValorBalanza = {
  // …el resto no cambia: estado, soportado, lectura, error, desconectar, capturar
  /** El último fallo, o `null` si no ha habido ninguno. */
  fallo: FalloBalanza | null
  /** `sinFiltro` abre el selector con todos los puertos, no solo los FTDI. */
  conectar: (sinFiltro?: boolean) => Promise<void>
}
```

`sinFiltro` viaja hasta el transporte y afecta a los dos sitios donde hoy se
elige puerto: `getPorts()` deja de exigir que el `getInfo()` sea FTDI, y
`requestPort()` se llama sin `filters`.

`error: string | null` se queda como está, para el texto que ya se pinta.

---

## 6 · El diálogo de preparación

`src/features/balanza/DialogoPrepararBalanza.tsx`

Quién lo abre: `BarraBalanza` y `BotonBalanza` ya llaman a `conectar()` y ya
atrapan su rechazo. Donde hoy pintan un texto o un `Snackbar`, pasan a mirar el
caso —`e instanceof ErrorBalanza && e.caso === 'sin-puerto'`— y levantar el
diálogo. Los demás casos siguen como están. El diálogo no se monta solo ni
observa el contexto: lo abre quien intentó conectar.

Cuatro bloques, en este orden:

**1 · Revisa el cable.** Qué tiene que estar enchufado y dónde: el adaptador en
un USB de la computadora, el otro extremo en el puerto de la balanza, y la
balanza encendida.

**2 · Instala el driver, una sola vez por computadora.** Un `Button` grande con
`href="/drivers/CDM2123620_Setup.exe"` y `download`, y debajo lo que Windows va
a preguntar, nombrado tal cual:

- Chrome puede avisar de que es un programa: «Conservar».
- Windows pregunta «¿Quieres permitir que esta aplicación haga cambios en el
  dispositivo?»: «Sí».
- El asistente de FTDI: «Siguiente», aceptar la licencia, «Finalizar».

Anticipar los diálogos por su nombre es la diferencia entre seguir y abandonar.

**3 · Desenchufa el adaptador y vuelve a enchufarlo.** El paso que se olvida
siempre. Si el dispositivo ya estaba conectado como desconocido, instalar el
paquete no hace que Windows lo reevalúe solo.

**4 · Reintentar.** Vuelve a llamar a `conectar()` sin recargar la página. Si
funciona, el diálogo se cierra y la captura sigue donde estaba.

Al pie, en texto pequeño: **«Mi adaptador no es FTDI»**, que reintenta sin el
filtro de D5.

### Contrato

```ts
type Props = {
  abierto: boolean
  onCerrar: () => void
  /** Reintenta la conexión. `sinFiltro` salta el filtro de fabricante. */
  onReintentar: (sinFiltro?: boolean) => Promise<void>
}
```

No usa `useBalanza()`: recibe lo que necesita. Así se prueba sin montar el
proveedor y no le importa quién lo abrió.

---

## 7 · Los archivos

```
public/drivers/
  CDM2123620_Setup.exe          2.3 MB · lo que sirve la app

drivers/
  LEEME.md                      qué es esto y por qué está en el repo
  ftdi-vcp/
    CDM2123620_Setup/
      CDM2123620_Setup.exe      el original del que sale la copia de public/
    CDM-v2.12.36.20-WHQL-Certified/   respaldo para instalación manual
```

Se borran `CDM-v2.12.36.20-WHQL-Certified.zip` y `CDM2123620_Setup.zip` (D6).

El ejecutable queda dos veces, en `drivers/` y en `public/drivers/`. Son 2.3 MB
de duplicación y es deliberado: `drivers/` es el archivo del proyecto y
`public/` es lo que se publica. `LEEME.md` deja escrito que son el mismo archivo
y cuál manda.

`vercel.json` no se toca. Su `rewrite` a `/index.html` es un catch-all, pero
Vercel resuelve el sistema de archivos **antes** de aplicar los `rewrites`, así
que la descarga no se la come el SPA. Es la primera cosa que hay que confirmar
en el despliegue, y si fallara se arregla con una regla previa que excluya
`/drivers/`.

---

## 8 · Pruebas

Con el doble de puerto serie de `balanza.test.ts`, que ya simula el candado de
`readable`:

- `requestPort` recibe el filtro `usbVendorId: 0x0403`.
- `getPorts()` ignora un puerto cuyo `getInfo()` no sea FTDI, y toma el que sí.
  Es la prueba del fallo del Arduino de D5.
- Un rechazo `NotFoundError` produce `sin-puerto`, no `desconocido`.
- Un rechazo al abrir produce `ocupado`.
- `no-soportado` cuando `navigator.serial` no existe.

Del diálogo, con Testing Library:

- Sale al conectar cuando el transporte falla con `sin-puerto`, y **no** sale
  con `ocupado` ni con `desconocido`.
- El botón de descarga apunta a `/drivers/CDM2123620_Setup.exe`. La descarga en
  sí no se prueba: se afirma el `href`.
- «Reintentar» vuelve a llamar a conectar; si esta vez funciona, el diálogo se
  cierra.
- «Mi adaptador no es FTDI» reintenta con `sinFiltro`.

`web-serial.d.ts` gana `getInfo(): { usbVendorId?: number; usbProductId?: number }`,
que hoy no está declarado.

---

## 9 · Riesgos

**El filtro esconde un adaptador legítimo.** Si algún almacén acaba con un
adaptador que no es FTDI, el selector sale vacío y parece que no hay balanza. Lo
cubre la salida de D5, pero está al pie del diálogo y en letra pequeña: si pasa
más de una vez, hay que subirla.

**El `.exe` desde Vercel asusta.** La firma EV baja mucho el aviso, pero Chrome
puede seguir preguntando. El bloque 2 del diálogo lo anticipa por escrito; no
hay forma de eliminarlo del todo desde una página web.

**El certificado de FTDI vence en marzo de 2027.** Una firma vencida no invalida
lo ya firmado con sellado de tiempo, pero conviene anotarlo: si para entonces el
proyecto sigue vivo, toca bajar el CDM del día.

**Windows puede no reevaluar el dispositivo.** El bloque 3 pide desenchufar y
volver a enchufar precisamente por esto. Si aun así no aparece, la salida es
reiniciar, y eso el diálogo no lo dice para no alargarlo. Queda en `LEEME.md`.

---

## 10 · Lo que queda fuera

**Que el driver no haga falta.** Un adaptador USB-serie que se anuncie como
**USB CDC-ACM** usa el driver que Windows ya trae y no necesita instalar nada,
nunca, en ninguna máquina. Es la única solución que elimina el problema en vez
de gestionarlo, y cuesta comprar cuatro cables y verificar un modelo concreto.
Vale la pena probarlo en paralelo: si sale, el camino guiado de este diseño casi
no se usa. No se mete aquí porque es una decisión de compra, no de código.

**Empaquetar la app como aplicación de escritorio.** Un instalador de Tauri o
Electron podría meter el driver en el mismo paso que la app, y el problema
desaparecería. Hoy la app es Vite servida en Vercel y abierta en Chrome, y
cambiar eso es un proyecto aparte.

**Preparar la máquina desde fuera** —un script o una USB que deje todo listo—.
Optimiza el día que está el desarrollador delante, que es el que no importa: el
escenario de este diseño es la persona sola, meses después, cuando le cambien el
equipo.
