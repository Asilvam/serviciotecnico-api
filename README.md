# Servicio Técnico API

API REST construida con [NestJS](https://nestjs.com/) para gestionar un negocio de servicio técnico: autenticación, clientes, técnicos, productos, órdenes de servicio, auditoría e impresión térmica de tickets.

## Resumen

- 🔐 Autenticación JWT con registro, login y perfil.
- 👥 CRUD de clientes.
- 🔧 CRUD de técnicos.
- 📦 CRUD de productos / repuestos.
- 📋 Órdenes de servicio con estados, costos y repuestos.
- 🧾 Generación de ticket térmico de **80 mm** para órdenes.
- 📚 Swagger en `/api`.
- 🧾 Auditoría de acciones, visible solo para usuarios `admin`.
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
http://localhost:3500/api
```

### Cómo usar Bearer token en Swagger

1. Ejecuta `POST /auth/login` o `POST /auth/register`.
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

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/profile`

Roles soportados:

- `admin`
- `technician`
- `receptionist`

### Customers

- `GET /customers`
- `POST /customers`
- `GET /customers/:id`
- `PATCH /customers/:id`
- `DELETE /customers/:id`

### Technicians

- `GET /technicians`
- `POST /technicians`
- `GET /technicians/:id`
- `PATCH /technicians/:id`
- `DELETE /technicians/:id`

### Products

- `GET /products`
- `POST /products`
- `GET /products/:id`
- `PATCH /products/:id`
- `DELETE /products/:id`

### Service Orders

- `GET /service-orders`
- `POST /service-orders`
- `GET /service-orders/:id`
- `PATCH /service-orders/:id`
- `DELETE /service-orders/:id`
- `POST /service-orders/:id/print-80mm`

### Audit

- `GET /audit-logs`

> Solo los usuarios con rol `admin` pueden consultar los logs de auditoría.

## Flujo rápido de prueba

### 1. Registrar usuario

```bash
curl -X POST http://localhost:3500/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
	"email": "admin@test.com",
	"password": "123456",
	"name": "Admin Prueba"
  }'
```

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

La respuesta incluye una acción lista para imprimir:

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

### 6. Generar ticket térmico 80mm

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
  "width": 48,
  "paperWidthMm": 80,
  "generatedAt": "2026-04-08T00:00:00.000Z"
}
```

## Impresión térmica 80mm

La API **no imprime físicamente por sí sola**. Lo que hace es generar el contenido del ticket en texto plano para una impresora térmica de 80 mm.

Características actuales del ticket:

- `paperWidthMm: 80`
- `width: 48` columnas en texto plano
- `mimeType: text/plain`

El flujo recomendado es:

1. El backend genera el ticket con `POST /service-orders/:id/print-80mm`.
2. El frontend o un agente local recibe `content`.
3. Ese cliente local lo envía a la impresora térmica.

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

