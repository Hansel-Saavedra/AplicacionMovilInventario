# Inventario Ropa — API (backend)

Backend independiente (Node.js + Express + TypeScript + Prisma) del sistema de control de
inventario, cartera de clientes y proyección de ganancias para un negocio de reventa de ropa.

Esta API expone, por HTTP, exactamente la misma lógica de negocio que antes vivía dentro de
la app Android (en `ProductoRepository`, `VentaRepository`, `CarteraRepository`,
`GananciaRepository` y `AuthRepository`). Las reglas de negocio, las validaciones y los
comentarios `RF-XXX` que trazan cada función a su requerimiento se mantuvieron idénticos.

## Requisitos previos

- Node.js 18 o superior.
- Una base de datos PostgreSQL. La forma más simple para un proyecto académico es crear una
  gratuita en [Supabase](https://supabase.com), [Neon](https://neon.tech) o
  [Railway](https://railway.app).

## Instalación y ejecución local

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Copia el archivo de variables de entorno y complétalo con tus propios valores:
   ```bash
   cp .env.example .env
   ```
   - `DATABASE_URL` y `DIRECT_URL`: las dos cadenas de conexión de tu base de datos
     (ver la sección **"Conectar con Supabase"** más abajo para saber exactamente
     cuáles copiar — usar la cadena equivocada es la causa más común de errores
     de conexión).
   - `JWT_SECRET`: cualquier cadena larga y aleatoria (puedes generar una con
     `openssl rand -base64 32`).
3. Genera el cliente de Prisma y crea las tablas en tu base de datos:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```
4. Carga los datos de prueba (un usuario y tres productos de ejemplo, iguales a los que ya
   usa la app Android):
   ```bash
   npm run seed
   ```
5. Levanta el servidor en modo desarrollo:
   ```bash
   npm run dev
   ```
   Por defecto queda escuchando en `http://localhost:3000`.

### Credenciales de prueba (datos semilla)

- **Usuario:** `tienda.ropa`
- **Contraseña:** `1234abcd`
- **Pregunta de seguridad:** ¿Cuál es el nombre de tu primera mascota? → **Respuesta:** `firulais`

## Conectar con Supabase

Si usas [Supabase](https://supabase.com) como base de datos (recomendado para este proyecto),
sigue estos pasos exactos para evitar el error más común al conectar Prisma con Supabase.

### Dónde encontrar las cadenas de conexión

1. En el dashboard de tu proyecto de Supabase, haz clic en el botón **Connect** (parte
   superior).
2. Ahí verás varias opciones de conexión. Necesitas copiar **dos**, no solo una:
   - **Transaction pooler** (puerto `6543`) → va en `DATABASE_URL`.
   - **Session pooler** (puerto `5432`) → va en `DIRECT_URL`.
3. En ambas, reemplaza `[YOUR-PASSWORD]` por la contraseña de tu base de datos.
4. A la URL de `DATABASE_URL` (la del puerto 6543) agrégale `?pgbouncer=true` al final.

### ¿Por qué dos cadenas y no una sola?

- La opción **"Direct connection"** (puerto 5432, sin "pooler" en el nombre) que Supabase
  muestra por defecto **solo funciona por IPv6**. Muchas redes (proveedores de internet
  residenciales, redes universitarias, etc.) no tienen salida IPv6, y ahí es donde aparece
  el error `Can't reach database server at ...`, aunque la cadena esté copiada
  correctamente.
- La solución es usar los **poolers** de Supabase (Session y Transaction), que sí funcionan
  con IPv4. Se necesitan los dos porque el pooler de transacciones (el que usa la app en
  producción) no soporta bien las operaciones de creación/modificación de tablas que hace
  `prisma migrate`; para eso se usa el pooler de sesión.

### Solución de problemas

| Error | Causa probable | Solución |
|---|---|---|
| `Can't reach database server at db.xxxx.supabase.co:5432` | Estás usando la cadena de "Direct connection" (solo IPv6) | Cambia a las cadenas de pooler descritas arriba |
| `Authentication failed against database server` | Contraseña incorrecta o sin reemplazar `[YOUR-PASSWORD]` | Verifica la contraseña; si tiene símbolos especiales, resetéala desde Settings > Database sin usar `@ # $ % /` |
| `P1001` o timeout tras varios segundos | El proyecto de Supabase aún se está aprovisionando | Espera 1-2 minutos e inténtalo de nuevo |
| Error solo con `prisma migrate dev`, pero la app corre bien | Falta la variable `DIRECT_URL`, o `schema.prisma` no la referencia | Confirma que `schema.prisma` tenga `directUrl = env("DIRECT_URL")` (ya viene así en este proyecto) |

## Estructura del proyecto

```
backend-api/
├── prisma/
│   └── schema.prisma        Modelo de datos (idéntico al de la app Android)
├── src/
│   ├── app.ts                Configuración de Express y montaje de rutas
│   ├── server.ts             Punto de entrada
│   ├── seed.ts                Datos de prueba
│   ├── config/prisma.ts       Cliente de Prisma compartido
│   ├── utils/jwt.ts           Generación y verificación de tokens
│   ├── middleware/
│   │   ├── auth.middleware.ts    Exige un token JWT válido
│   │   └── error.middleware.ts   Manejo centralizado de errores
│   └── modules/
│       ├── auth/          Login (RF-USR-01)
│       ├── productos/     Inventario (RF-INV-*, RF-GAN-01)
│       ├── ventas/        Ventas (RF-VEN-*, RF-INV-07)
│       ├── cartera/       Clientes y abonos (RF-CAR-*)
│       └── ganancias/     Proyección de ganancias (RF-GAN-02 a 06)
```

Cada módulo sigue el mismo patrón de tres archivos: `*.routes.ts` (las URLs),
`*.controller.ts` (recibe la petición HTTP y llama al servicio) y `*.service.ts`
(la lógica de negocio real, sin nada de Express — es la parte que se corresponde
uno a uno con los repositorios de Kotlin).

## Endpoints principales

Todas las rutas, excepto `/auth/login`, `/auth/pregunta-seguridad` y
`/auth/restablecer-contrasena`, requieren el encabezado
`Authorization: Bearer <token>` obtenido al iniciar sesión.

| Método | Ruta | Requerimiento |
|---|---|---|
| POST | `/auth/login` | RF-USR-01 |
| GET | `/auth/pregunta-seguridad?usuario=` | RF-USR-03 (paso 1) |
| POST | `/auth/restablecer-contrasena` | RF-USR-03 (paso 2) |
| GET | `/productos` | RF-INV-04, RF-INV-05 |
| GET | `/productos/filtros` | valores para talla/color/categoría |
| POST | `/productos` | RF-INV-01, RF-GAN-01 |
| PUT | `/productos/:id` | RF-INV-02 |
| PATCH | `/productos/:id/desactivar` | RF-INV-03 |
| POST | `/productos/:id/entradas` | RF-INV-06 |
| GET | `/productos/:id/movimientos` | RF-INV-09 |
| POST | `/productos/:id/foto` (multipart, campo `foto`) | RF-INV-10 |
| POST | `/ventas` | RF-VEN-01 a RF-VEN-04, RF-INV-07 |
| GET | `/ventas` | RF-VEN-05 |
| PATCH | `/ventas/:id/anular` | RF-VEN-06 |
| GET | `/cartera` | RF-CAR-07 |
| POST | `/cartera/clientes` | RF-CAR-01 |
| GET | `/cartera/clientes/:id/saldo` | RF-CAR-05 |
| GET | `/cartera/clientes/:id/abonos` | RF-CAR-06 |
| POST | `/cartera/clientes/:id/abonos` | RF-CAR-04, RF-CAR-08 |
| GET | `/ganancias/resumen?desde=&hasta=` | RF-GAN-03, RF-GAN-06 |
| GET | `/ganancias/por-producto?desde=&hasta=` | RF-GAN-04 |
| GET | `/ganancias/proyeccion` | RF-GAN-05 |
| GET | `/ganancias/iva?desde=&hasta=` | IVA generado en el periodo (19 %) |

Todas las respuestas que incluyen un producto (`GET /productos`, `GET /productos/:id`,
y las de crear/editar/desactivar/reabastecer/subir foto) traen además dos campos
calculados: `valorBaseVenta` y `valorIvaVenta`, que descomponen `precioVenta`
—interpretado como el precio final al público, IVA incluido— en su valor base
gravable y el IVA correspondiente (tarifa general del 19 %).

### Ejemplo: iniciar sesión

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario": "tienda.ropa", "contrasena": "1234abcd"}'
```

### Ejemplo: recuperar contraseña

```bash
# Paso 1: consultar la pregunta de seguridad
curl "http://localhost:3000/auth/pregunta-seguridad?usuario=tienda.ropa"

# Paso 2: responder y establecer la nueva contraseña
curl -X POST http://localhost:3000/auth/restablecer-contrasena \
  -H "Content-Type: application/json" \
  -d '{"usuario": "tienda.ropa", "respuestaSeguridad": "firulais", "nuevaContrasena": "otraClaveSegura"}'
```

### Ejemplo: subir la foto de un producto

```bash
curl -X POST http://localhost:3000/productos/1/foto \
  -H "Authorization: Bearer <TOKEN_OBTENIDO_EN_EL_LOGIN>" \
  -F "foto=@/ruta/a/la/imagen.jpg"
```

### Ejemplo: consultar el IVA generado en un periodo

```bash
curl "http://localhost:3000/ganancias/iva?desde=2026-09-01&hasta=2026-09-30" \
  -H "Authorization: Bearer <TOKEN_OBTENIDO_EN_EL_LOGIN>"
```
Respuesta: `{ "valorBase": 33613.45, "valorIva": 6386.55, "valorTotal": 40000 }`

### Ejemplo: registrar una venta de contado

```bash
curl -X POST http://localhost:3000/ventas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_OBTENIDO_EN_EL_LOGIN>" \
  -d '{
        "items": [{ "productoId": 1, "cantidad": 2 }],
        "formaPago": "CONTADO"
      }'
```

## Actualizar una instalación ya desplegada

Si ya tenías este backend corriendo (por ejemplo, en Render) antes de que se agregaran
RF-USR-03 y RF-INV-10, el esquema de la base de datos cambió: se agregaron las columnas
`preguntaSeguridad` y `respuestaSeguridadHash` en `usuarios`, y `imagenUrl` en `productos`.
Para actualizar tu base de datos ya existente en Supabase:

```bash
npx prisma generate
npx prisma migrate dev --name agregar_recuperacion_y_foto
npm run seed
```

El `seed` es seguro de volver a ejecutar: no duplica productos ni usuarios, pero sí
actualiza la pregunta de seguridad del usuario existente (ver Sección "Credenciales
de prueba" más abajo). No olvides completar también las nuevas variables
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_STORAGE_BUCKET` en Render.

## Configurar el bucket de fotos (Supabase Storage)

RF-INV-10 (foto de producto) sube las imágenes a Supabase Storage, en el mismo
proyecto donde ya está la base de datos. Antes de usarlo:

1. En el panel de Supabase, ve a **Storage** (menú lateral) → **New bucket**.
2. Nómbralo `productos-fotos` (o el nombre que pongas en `SUPABASE_STORAGE_BUCKET`).
3. Marca la opción **Public bucket** al crearlo — así las fotos se pueden ver
   directamente desde su URL, sin necesitar autenticación adicional.
4. Copia `SUPABASE_URL` y la clave **service_role** (Settings → API) a tu `.env`,
   siguiendo las instrucciones del `.env.example`.
5. Ejecuta las migraciones (`npx prisma migrate dev`) para crear la columna
   `imagenUrl` en la tabla `productos`.

Si estas variables no están configuradas, el endpoint `/productos/:id/foto`
responde con un error claro en vez de fallar de forma silenciosa.

## Pruebas automatizadas

El backend incluye una suite de pruebas unitarias (Jest) para la lógica de
negocio más crítica: el cálculo de IVA, la validación de stock y el registro
transaccional de ventas, y la aplicación FIFO de abonos en la cartera de
clientes.

```bash
npm test
```

Las pruebas **no requieren conexión a una base de datos real**: sustituyen el
cliente de Prisma por un doble en memoria (`src/test-utils/fakePrisma.ts`), lo
que las hace rápidas y reproducibles en cualquier máquina, incluida una
integración continua (CI). Los archivos de prueba están junto a cada servicio
que validan (`*.service.test.ts`), y cubren, entre otros casos:

- Que un abono se aplique primero a la venta a crédito más antigua (FIFO), y
  que una venta se marque automáticamente como pagada al llegar a saldo cero.
- Que una venta se rechace si el producto no tiene stock suficiente, sin
  modificar el inventario.
- Que anular una venta restablezca correctamente el inventario descontado.
- Que el desglose de IVA de $40.000 sea exactamente el del ejemplo del
  docente mediador (base ≈ $33.613 + IVA ≈ $6.387).

## Despliegue

1. **Base de datos:** si usas Supabase, sigue la sección **"Conectar con Supabase"** de
   arriba para obtener tus dos cadenas de conexión (`DATABASE_URL` y `DIRECT_URL`).
2. **Backend:** crea un servicio en [Render](https://render.com) o
   [Railway](https://railway.app) apuntando a este repositorio, con:
   - Build command: `npm install && npm run build && npx prisma generate`
   - Start command: `npm start`
   - Variables de entorno: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `SUPABASE_URL`,
     `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_STORAGE_BUCKET` (las mismas del paso 1
     y de la sección "Configurar el bucket de fotos").
3. Si es la primera vez que despliegas y todavía no has corrido las migraciones contra esta
   base de datos, ejecútalas una vez (puedes hacerlo desde tu computador local, apuntando a
   las mismas variables de entorno de producción):
   ```bash
   npx prisma migrate deploy
   ```
4. Copia la URL pública que te da el servicio (por ejemplo,
   `https://inventario-ropa-api.onrender.com`) — esa es la URL base que la app Android
   usará en Retrofit.

## Nota sobre la validación de este proyecto

Este backend se verificó ejecutando `npm install` y compilando con TypeScript
(`npx tsc --noEmit`) en un entorno con acceso restringido a internet, en el que
`npx prisma generate` no pudo descargar el motor de consultas de Prisma (requiere acceso a
`binaries.prisma.sh`, bloqueado en ese entorno). Para poder revisar igualmente la corrección
del resto del código, se generó temporalmente una declaración de tipos local que imita la
forma del cliente de Prisma, se compiló contra ella sin errores, y luego se eliminó (no forma
parte del proyecto). Al ejecutar `npx prisma generate` en un computador con acceso normal a
internet, este paso se completa sin problema y el proyecto queda con los tipos reales.
