# Drivers

El driver VCP de FTDI, que es lo que hace que el adaptador USB-serie de la
balanza aparezca como un puerto COM en Windows. Sin él, al enchufarlo Windows lo
registra como «Dispositivo desconocido», no hay puerto, y para el navegador la
balanza no existe: Web Serial enumera puertos serie, así que un dispositivo sin
driver es invisible.

Por qué vive en el repositorio y no se baja de FTDI cuando haga falta: quien va
a instalarlo es el responsable de un almacén, solo, y el sitio de FTDI ofrece
varias descargas en una tabla en inglés. El archivo que sirve la app es uno solo
y es el correcto.

## Qué hay aquí

```
ftdi-vcp/
  CDM2123620_Setup/CDM2123620_Setup.exe    el instalador — es el que se usa
  CDM-v2.12.36.20-WHQL-Certified/          los .inf y .sys sueltos — respaldo
```

**`CDM2123620_Setup.exe` es el que importa.** Mete el driver en el almacén de
drivers de Windows, y a partir de ahí cualquier adaptador FTDI que se enchufe en
esa computadora levanta su COM solo, para siempre y en cualquier puerto USB. Se
ejecuta una vez por máquina.

Está firmado con certificado EV de Future Technology Devices International Ltd,
válido hasta el 27 de marzo de 2027. Esa firma es lo que evita que SmartScreen
lo bloquee. **Si el certificado vence y el proyecto sigue vivo, hay que bajar el
CDM del día desde ftdichip.com y reemplazar los dos archivos** (este y la copia
de `public/`).

**`CDM-v2.12.36.20-WHQL-Certified/`** es el mismo driver sin empaquetar. Solo
sirve para la máquina rara donde el ejecutable falle: Administrador de
dispositivos → el dispositivo con el triángulo → Actualizar controlador →
Buscar en mi PC → esta carpeta. Es un camino manual y largo; no es el plan A.

## La copia de `public/drivers/`

`public/drivers/CDM2123620_Setup.exe` es **el mismo archivo**, byte a byte.
Existe porque Vite solo publica `public/`, y la app necesita poder servirlo en
`/drivers/CDM2123620_Setup.exe` para que el diálogo de preparación lo ofrezca a
un clic.

Manda el de aquí: `drivers/` es el archivo del proyecto y `public/` es lo que se
despliega. Si algún día se actualiza el driver, hay que actualizar los dos.

## Si aun así no aparece el puerto

Después de instalar hay que **desenchufar el adaptador y volver a enchufarlo**.
Windows no reevalúa solo un dispositivo que ya estaba conectado como
desconocido. Si después de eso sigue sin aparecer, reiniciar la computadora.

Diseño completo en `docs/specs/2026-09-21-instalacion-driver-balanza-design.md`.
