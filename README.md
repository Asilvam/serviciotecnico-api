# Servicio Técnico API

Backend REST API built with [NestJS](https://nestjs.com/) for managing a technical repair service business.

## Features

- 🔐 **JWT Authentication** — Register, login, and protected routes
- 👥 **Customers** — Customer management (CRUD)
- 🔧 **Technicians** — Technician management with specialties
- 📦 **Products/Parts** — Inventory management with stock control
- 📋 **Service Orders** — Full repair order lifecycle with status tracking
- 📖 **Swagger UI** — Interactive API documentation at `/api`
- 🗄️ **SQLite** (dev) / **PostgreSQL** (prod) via TypeORM

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

| Variable        | Description                         | Default              |
|-----------------|-------------------------------------|----------------------|
| `PORT`          | HTTP server port                    | `3000`               |
| `NODE_ENV`      | Environment                         | `development`        |
| `DATABASE_PATH` | SQLite file path (dev only)         | `serviciotecnico.db` |
| `JWT_SECRET`    | Secret key for JWT token signing    | `changeme`           |

### Running the App

```bash
# development
npm run start:dev

# production
npm run start:prod
```

### API Documentation

Once the app is running, visit **http://localhost:3000/api** for the Swagger UI.

## Available Endpoints

| Method | Path                         | Description                    |
|--------|------------------------------|--------------------------------|
| POST   | `/auth/register`             | Register a new user            |
| POST   | `/auth/login`                | Login and get JWT token        |
| GET    | `/auth/profile`              | Get current user profile       |
| GET    | `/customers`                 | List all customers             |
| POST   | `/customers`                 | Create a customer              |
| GET    | `/customers/:id`             | Get customer by ID             |
| PATCH  | `/customers/:id`             | Update customer                |
| DELETE | `/customers/:id`             | Deactivate customer            |
| GET    | `/technicians`               | List all technicians           |
| POST   | `/technicians`               | Create a technician            |
| GET    | `/technicians/:id`           | Get technician by ID           |
| PATCH  | `/technicians/:id`           | Update technician              |
| DELETE | `/technicians/:id`           | Deactivate technician          |
| GET    | `/products`                  | List all products/parts        |
| POST   | `/products`                  | Create a product               |
| GET    | `/products/:id`              | Get product by ID              |
| PATCH  | `/products/:id`              | Update product                 |
| DELETE | `/products/:id`              | Deactivate product             |
| GET    | `/service-orders`            | List service orders            |
| POST   | `/service-orders`            | Create a service order         |
| GET    | `/service-orders/:id`        | Get service order by ID        |
| PATCH  | `/service-orders/:id`        | Update service order           |
| DELETE | `/service-orders/:id`        | Cancel service order           |

## Running Tests

```bash
# unit tests
npm test

# test with coverage
npm run test:cov

# e2e tests
npm run test:e2e
```

## Project Structure

```
src/
├── auth/               # JWT authentication
├── customers/          # Customer management
├── technicians/        # Technician management
├── products/           # Product/parts inventory
├── service-orders/     # Service order lifecycle
├── app.module.ts       # Root module
└── main.ts             # Application entry point
```
