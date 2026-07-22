# Servicio Técnico API

API REST construida con [NestJS](https://nestjs.com/) para gestionar un negocio de servicio técnico: autenticación, clientes, técnicos, productos, órdenes de servicio, auditoría e impresión térmica de tickets.

## Resumen

- 🔐 Autenticación JWT con login y perfil (registro deshabilitado públicamente por seguridad).
- 👥 Gestión de clientes disponibles y no disponibles.
- 🔧 Gestión de técnicos, especialidades y disponibilidad.
- 📦 CRUD de productos / repuestos.
- 📋 Órdenes de servicio con permisos por rol, estados, costos, repuestos y control de stock.
- 🧾 Generación de ticket térmico de **80 mm** para órdenes.
- 📚 Swagger en `/api`.
- 🧾 Auditoría de acciones sensibles, visible solo para usuarios `admin`.
- 🗄️ Persistencia en **MongoDB Atlas** usando **TypeORM**.

## Stack

- NestJS 11
- TypeORM con MongoDB
- Passport + JWT
- Swagger (`@nestjs/swagger`)
- Class Validator / Class Transformer
- Node.js `22.19.0`
- npm `10.9.3`

## Requisitos

- Node.js `22.19.0` o una versión compatible de Node 22
- npm `10.9.3` o compatible
- Acceso a una base de datos MongoDB Atlas

## Instalación

```bash
npm install
```

## Configuración

El proyecto incluye un archivo `/.env.example`. Cópialo a `/.env`:

```bash
cp .env.example .env
```

Variables disponibles:

| Variable | Descripción | Ejemplo / valor local |
|---|---|---|
| `PORT` | Puerto HTTP de la API | `3500` |
| `NODE_ENV` | Ambiente de ejecución | `development` |
| `SWAGGER_PATH` | Ruta de Swagger UI | `api` |
| `SWAGGER_TITLE` | Titulo de la documentacion | `Servicio Tecnico API` |
| `SWAGGER_DESCRIPTION` | Descripcion visible en Swagger | `API para gestion de servicio tecnico` |
| `SWAGGER_VERSION` | Version de la API en Swagger | `1.0` |
| `MONGODB_URI` | URI de conexión a MongoDB Atlas | `mongodb+srv://...` |
| `MONGODB_DB` | Nombre de la base de datos | `serviciotecnico` |
| `JWT_SECRET` | Secreto para firmar JWT | `cambia-esto-en-produccion` |

### Notas importantes

- En local, si tu `.env` tiene `PORT=3500`, la API levantará en `http://localhost:3500`.
- En `src/main.ts`, el fallback es `4500`, pero **solo se usa si `PORT` no está definido**.
- La conexión actual del proyecto está orientada a **MongoDB**, no a SQLite.

## Ejecutar el proyecto

```bash
# desarrollo
npm run start:dev

# producción
npm run build
npm run start:prod
```

## Verificar que la API está arriba

Health endpoint:

```bash
curl http://localhost:3500/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "timestamp": "2026-04-08T00:00:00.000Z"
}
```

## Swagger

Una vez levantada la API:

```text
http://localhost:3500/${SWAGGER_PATH:-api}
```

### Cómo usar Bearer token en Swagger

1. Ejecuta `POST /auth/login`.
2. Copia el valor de `accessToken`.
3. Haz clic en **Authorize** en Swagger.
4. Pega el token en este formato:

```text
Bearer TU_TOKEN
```

5. Ejecuta los endpoints protegidos.

## Módulos principales

### Auth

Endpoints:

- `POST /auth/login`
- `GET /auth/profile`

### Users (admin)

- `POST /users`
- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`

Permisos y comportamiento:

- Todos los endpoints de `/users` requieren JWT (`AuthGuard('jwt')`).
- Solo rol `admin` puede ejecutar estas rutas.
- Las respuestas de usuarios no incluyen `password`.
- `DELETE /users/:id` aplica borrado lógico (`isActive=false`).
- Un usuario desactivado no puede iniciar sesión.

Payload para crear usuario (`POST /users`):

```json
{
  "email": "tech1@test.com",
  "password": "123456",
  "name": "Tecnico Uno",
  "role": "technician",
  "isActive": true
}
```

Payload para actualizar usuario (`PATCH /users/:id`):

```json
{
  "name": "Tecnico Uno Actualizado",
  "role": "receptionist",
  "isActive": true
}
```

Ejemplos rápidos:

```bash
# Listar usuarios (admin)
curl -X GET http://localhost:3500/users \
  -H 'Authorization: Bearer TU_TOKEN_ADMIN'

# Crear usuario (admin)
curl -X POST http://localhost:3500/users \
  -H 'Authorization: Bearer TU_TOKEN_ADMIN' \
  -H 'Content-Type: application/json' \
  -d '{
	"email": "recep1@test.com",
	"password": "123456",
	"name": "Recepcion Uno",
	"role": "receptionist"
  }'

# Desactivar usuario (admin)
curl -X DELETE http://localhost:3500/users/USER_ID \
  -H 'Authorization: Bearer TU_TOKEN_ADMIN'
```

Roles soportados:

- `admin`
- `technician`
- `receptionist`

### Customers

- `GET /customers`
- `POST /customers` (Admin y Recepción)
- `GET /customers/:id`
- `PATCH /customers/:id` (Admin y Recepción)
- `DELETE /customers/:id` (Admin únicamente)
- `DELETE /customers/:id/permanent` (Admin únicamente)

Comportamiento:

- Admin recibe clientes activos e inactivos; Recepción solo recibe clientes disponibles.
- Admin puede cambiar `isActive` mediante `PATCH`; Recepción puede corregir los demás datos, pero no cambiar el estado.
- Un cliente no disponible no puede utilizarse al crear o reasignar una orden.
- `DELETE /customers/:id` conserva el registro y establece `isActive=false`.
- El borrado permanente solo se permite cuando el cliente no tiene órdenes asociadas y queda registrado en auditoría.

### Technicians

- `GET /technicians`
- `POST /technicians` (Admin únicamente)
- `GET /technicians/:id`
- `PATCH /technicians/:id` (Admin únicamente)
- `DELETE /technicians/:id` (Admin únicamente)
- `DELETE /technicians/:id/permanent` (Admin únicamente)

Comportamiento:

- Admin recibe técnicos disponibles y no disponibles; Recepción solo recibe técnicos disponibles.
- Admin puede cambiar `isActive` dentro de la actualización del técnico.
- Un técnico no disponible no puede asignarse a una orden nueva ni utilizarse en una reasignación.
- Una asignación histórica existente se conserva aunque posteriormente el técnico quede no disponible.
- El borrado permanente solo se permite cuando el técnico no tiene órdenes asociadas y queda registrado en auditoría.

### Products

- `GET /products`
- `POST /products` (Admin únicamente)
- `GET /products/:id`
- `PATCH /products/:id` (Admin únicamente)
- `DELETE /products/:id` (Admin únicamente)

### Service Orders

- `GET /service-orders`
- `POST /service-orders` (Admin y Recepcion)
- `GET /service-orders/:id`
- `PATCH /service-orders/:id` (Admin, Recepcion y Tecnico)
- `DELETE /service-orders/:id` (Admin únicamente; cancela la orden)
- `DELETE /service-orders/:id/permanent` (Admin únicamente; borrado físico)
- `POST /service-orders/:id/print-80mm` (Admin, Recepcion y Tecnico)

Estados disponibles:

- `pending`
- `in_progress`
- `waiting_parts`
- `completed`
- `delivered`
- `cancelled`

Permisos operativos:

- **Admin:** ve todas las órdenes, puede modificar todos los campos válidos, cancelar y eliminar físicamente.
- **Recepción:** crea órdenes; corrige datos de ingreso mientras están pendientes; administra técnico, prioridad y fecha en estados operativos; y pasa de `completed` a `delivered`.
- **Técnico:** solo ve sus órdenes asignadas; modifica diagnóstico, trabajo realizado y repuestos; y ejecuta transiciones técnicas válidas.

Transiciones del técnico:

```text
pending -> in_progress
in_progress -> waiting_parts | completed
waiting_parts -> in_progress | completed
```

Reglas relevantes:

- Para cancelar se debe usar `DELETE /service-orders/:id`; no se acepta asignar `cancelled` mediante `PATCH`.
- La cancelación es idempotente y restaura el stock de los repuestos cuando corresponde.
- El borrado físico admite cualquier estado, registra una instantánea en auditoría y restaura inventario cuando corresponde.
- Los `PATCH` ignoran campos sin cambios y restringen los campos según el rol autenticado.

### Audit

- `GET /audit-logs`

> Solo los usuarios con rol `admin` pueden consultar los logs de auditoría.

## Flujo rápido de prueba

### 1. Inicializar el Primer Administrador
Debido a políticas de seguridad estrictas, el auto-registro público está deshabilitado. Para levantar el sistema por primera vez:
1. Conéctate a tu clúster de MongoDB Atlas (o local) usando MongoDB Compass o shell.
2. En la base de datos `serviciotecnico`, dentro de la colección `users`, inserta el primer usuario administrador.
3. Asegúrate de definir su campo `role` como `"admin"` y su contraseña encriptada usando `bcrypt`.

Ejemplo de documento en la colección `users`:
```json
{
  "email": "admin@test.com",
  "password": "$2a$10$YourHashedBcryptPasswordHere",
  "name": "Administrador Inicial",
  "role": "admin",
  "isActive": true
}
```

Una vez creado este primer usuario administrador, utilízalo para iniciar sesión:

### 2. Login

```bash
curl -X POST http://localhost:3500/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
	"email": "admin@test.com",
	"password": "123456"
  }'
```

Guarda el `accessToken` para las siguientes llamadas.

### 3. Crear cliente

```bash
curl -X POST http://localhost:3500/customers \
  -H 'Authorization: Bearer TU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
	"name": "Juan Perez",
	"email": "juan.perez@test.com",
	"phone": "+56911111111",
	"address": "Santiago"
  }'
```

### 4. Crear producto

```bash
curl -X POST http://localhost:3500/products \
  -H 'Authorization: Bearer TU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
	"name": "Pantalla LCD 15",
	"description": "Repuesto",
	"sku": "LCD-15-001",
	"price": 25000,
	"stock": 10
  }'
```

### 5. Crear orden de servicio

```bash
curl -X POST http://localhost:3500/service-orders \
  -H 'Authorization: Bearer TU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
	"customerId": "CUSTOMER_ID",
	"deviceType": "Laptop",
	"deviceBrand": "HP",
	"deviceModel": "Pavilion 15",
	"problemDescription": "No enciende",
	"priority": "medium",
	"items": [
	  {
		"productId": "PRODUCT_ID",
		"productName": "Pantalla LCD 15",
		"unitPrice": 25000,
		"quantity": 1
	  }
	]
  }'
```

La respuesta incluye una acción lista para imprimir. La creación de la orden no dispara impresión automática:

```json
{
  "order": {
	"id": "..."
  },
  "actions": {
	"print80mm": {
	  "method": "POST",
	  "url": "http://localhost:3500/service-orders/ORDER_ID/print-80mm"
	}
  }
}
```

### 6. Generar ticket térmico 80mm (manual)

```bash
curl -X POST http://localhost:3500/service-orders/ORDER_ID/print-80mm \
  -H 'Authorization: Bearer TU_TOKEN'
```

Respuesta esperada:

```json
{
  "orderId": "...",
  "orderNumber": "OT-20260408-1234",
  "mimeType": "text/plain",
  "content": "...",
  "width": 40,
  "paperWidthMm": 80,
  "generatedAt": "2026-04-08T00:00:00.000Z"
}
```

## Impresión térmica 80mm

La API **no imprime físicamente por sí sola**. Lo que hace es generar el contenido del ticket en texto plano para una impresora térmica de 80 mm.

Características actuales del ticket:

- `paperWidthMm: 80`
- `width: 40` columnas en texto plano
- `mimeType: text/plain`

El flujo recomendado es:

1. El frontend crea la orden con `POST /service-orders`.
2. El frontend solicita confirmación al usuario para imprimir.
3. Si el usuario confirma, se llama `POST /service-orders/:id/print-80mm`.
4. El backend genera y despacha el ticket al agente/local bridge.
5. El agente/local bridge envía `content` a la impresora térmica.

### Si imprimes desde una máquina local macOS

Puedes guardar `content` en un archivo `.txt` y mandarlo con `lp`:

```bash
lpstat -p
lp -d "NOMBRE_IMPRESORA" /ruta/al/ticket.txt
```

### Si el backend está en la nube

Necesitas un puente local de impresión:

- frontend + agente local
- servicio local de impresión
- o una integración tipo print-agent

## Auditoría y trazabilidad

El sistema registra acciones de negocio para auditoría. El endpoint visible es:

```text
GET /audit-logs
```

Filtros soportados:

- `entity`
- `action`
- `entityId`
- `userId`
- `limit`

Ejemplo:

```bash
curl -X GET 'http://localhost:3500/audit-logs?entity=service_order&limit=20' \
  -H 'Authorization: Bearer TU_TOKEN_ADMIN'
```

> Si el usuario no es `admin`, el endpoint responde con error de permisos.

Entre las acciones registradas se incluyen creación y actualización de órdenes, cancelaciones, borrado físico de órdenes y borrado físico de clientes o técnicos. Los registros conservan el actor y metadatos suficientes para reconstruir la acción sin mantener la entidad eliminada.

## Insomnia

El proyecto incluye una colección lista para importar:

```text
insomnia-serviciotecnico-export.json
```

Está alineada con:

- `http://localhost:3500`
- impresión `80mm`
- endpoint `/service-orders/:id/print-80mm`

## Scripts disponibles

```bash
npm run start
npm run start:dev
npm run start:debug
npm run build
npm run start:prod
npm run lint
npm test
npm run test:watch
npm run test:cov
npm run test:e2e
```

## Estructura del proyecto

```text
src/
├── app.controller.ts
├── app.module.ts
├── main.ts
├── auth/
├── audit/
├── customers/
├── technicians/
├── products/
├── service-orders/
├── printing/
└── common/
```

## Observaciones

- El proyecto usa MongoDB vía TypeORM.
- El puerto local documentado es `3500` porque coincide con el `.env` actual.
- Si cambias `PORT`, actualiza también tus herramientas cliente como Swagger/Insomnia.
- La impresión actualmente está orientada a **80 mm**, no a 58 mm.
