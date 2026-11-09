---
name: project-context
description: >
  Contexto técnico y arquitectónico del monorepo de la app de finanzas
  personales. Úsalo al elegir dónde implementar una funcionalidad, seguir el
  flujo Angular → NestJS → MongoDB, modificar contratos o entender qué partes
  del producto existen hoy.
---

# Contexto del proyecto

## Producto y estado actual

Aplicación web (PWA) de **finanzas personales** para uso individual y
portafolio. La visión del producto incluye cuentas, transacciones,
categorías jerárquicas, presupuestos, dashboard con KPIs y gráficos, reportes
exportables, importación de CSV y modo oscuro/PWA.

El código se construye por fases (ver plan de ejecución). Antes de asumir que
una funcionalidad está implementada, **comprueba el código y los tests** del
feature correspondiente.

Fases del producto (orden de implementación):

1. **Fase 0 — Cimientos**: monorepo, AuthModule backend + frontend, layout.
2. **Fase 1 — Núcleo transaccional**: Accounts, Categories, Transactions
   (CRUD + listados + filtros básicos).
3. **Fase 2 — Dashboard**: Analytics backend + Dashboard frontend con KPIs
   y Chart.js.
4. **Fase 3 — Presupuestos y reportes**: Budgets + exportación CSV/PDF.
5. **Fase 4 — Pulido**: dark mode, PWA, import CSV, modo Zen, auditoría de
   estados vacíos/errores.

## Stack comprobado

- Monorepo con **npm workspaces**: `client/` (Angular) y `server/`
  (NestJS). Scripts raíz con `concurrently` para desarrollo.
- **Backend**: NestJS (monolito modular por dominio), MongoDB + Mongoose,
  JWT en cookies `HttpOnly` + `Secure`, `class-validator` +
  `class-transformer`, `@nestjs/passport` + `passport-jwt`.
- **Frontend**: Angular 19+ con **NgModules** (NO standalone), Angular
  Material + CDK, Signals para estado (NO NgRx), Chart.js 4, reactive forms
  tipados.
- **Tests**: Jest (backend y frontend), `mongodb-memory-server` para
  integración, Playwright para e2e.
- **Calidad**: ESLint + Prettier en ambos workspaces.
- **Auth**: access token JWT (15 min) + refresh token JWT (7 días), ambos en
  cookies `HttpOnly`. El frontend nunca almacena tokens en `localStorage`/
  `sessionStorage`.

Confirma versiones y scripts en `package.json` y en cada workspace: esos
archivos son la fuente de verdad cuando cambie el stack.

## Workspaces y responsabilidades

| Ruta                           | Responsabilidad                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/core/`             | Infraestructura global: filters, guards, interceptors, constants.                                                                 |
| `server/src/common/`           | Utilidades sin estado: decorators (`@CurrentUser`), DTOs de paginación, pipes (`ParseObjectIdPipe`).                              |
| `server/src/modules/`          | El corazón del negocio, un módulo por dominio: `auth`, `users`, `accounts`, `transactions`, `categories`, `budgets`, `analytics`. |
| `server/src/app.module.ts`     | Composición de módulos. Importa `MongooseModule.forRootAsync`, `ConfigModule`, módulos de dominio.                                |
| `server/src/main.ts`           | Bootstrap, `ValidationPipe` global, CORS con `credentials: true`, cookies parser.                                                 |
| `client/src/app/core/`         | Servicios singleton: `AuthService`, `ApiService`, `ThemeService`, `LayoutService`, guards, interceptors.                          |
| `client/src/app/shared/`       | Componentes/pipes/directivas reutilizables (`EmptyStateComponent`, `CurrencyCentsPipe`, `ChartContainerDirective`).               |
| `client/src/app/features/`     | Feature modules lazy-loaded: `auth`, `layout`, `dashboard`, `transactions`, `accounts`, `categories`, `budgets`.                  |
| `client/src/app/app.module.ts` | Solo importa `CoreModule`, `SharedModule` y el módulo de layout/rutas top-level.                                                  |

## Dependencias y fronteras

- **`server/src/modules/*`** son autocontenidos. Si `TransactionsModule`
  necesita algo de `AccountsModule`, importa el módulo y usa sus exports.
  Nunca importes archivos internos de otro módulo directamente.
- **`common/` y `core/`** no dependen de `modules/`. Los módulos pueden
  depender de `core/` y `common/`.
- El **frontend no accede a MongoDB** ni a secretos. Toda lectura/escritura
  pasa por `HttpClient` contra los endpoints de NestJS.
- Los **feature modules** no comparten servicios de negocio entre sí. Si dos
  features necesitan el mismo estado (ej. `AccountsStoreService` en
  transactions y dashboard), el store vive en `core/` o en el feature dueño
  y se importa explícitamente.
- Los **componentes de feature no importan componentes de otro feature**.
  Si un componente es compartido, se mueve a `shared/`.
- **No introduzcas NgRx** sin decisión explícita de arquitectura. Signals +
  Store Services cubren el dominio.

## Reglas de datos existentes

- **IDs**: `ObjectId` de MongoDB en backend, `string` en frontend. Los DTOs
  usan `@IsMongoId()`.
- **Timestamps**: ISO-8601 UTC (`createdAt`, `updatedAt`). El frontend
  formatea a locale con `DatePipe`.
- **Montos**: **siempre en centavos (integer)** en DB, backend y transporte.
  La UI formatea con `CurrencyCentsPipe`. Nunca se envían floats por la red.
- **Transferencias**: un solo documento con `accountId` (origen) y
  `targetAccountId` (destino). No cuentan como ingreso ni gasto en analytics.
- **Categorías**: jerárquicas con `parentId` (nullable). Solo `expense` o
  `income`; no hay categorías para transferencias. La eliminación falla si
  tiene hijos o transacciones (409).
- **Índices obligatorios** en MongoDB:
  - `transactions`: `{ userId: 1, date: -1 }`,
    `{ userId: 1, accountId: 1, date: -1 }`.
  - `accounts`: `{ userId: 1, isArchived: 1 }`.
  - `categories`: `{ userId: 1, parentId: 1 }`,
    `{ userId: 1, name: 1, parentId: 1 }` (unique).
  - `tags`: `{ userId: 1, name: 1 }` (unique).
  - `budgets`: `{ userId: 1, categoryId: 1, period: 1 }` (unique).
  - **Añadir un índice** requiere migración documentada y justificación de
    la query que lo necesita.
- **Aislamiento por usuario**: toda query filtra por `userId` extraído del
  JWT. Un usuario no puede leer/modificar recursos de otro. Esta regla se
  testea explícitamente en services.
- **Soft delete** en `accounts` (`isArchived`); el resto de entidades se
  borran físicamente con `deleteOne` tras validar integridad referencial.

## Dónde trabajar

- **Entidades y lógica de negocio pura**: `server/src/modules/<domain>/*.service.ts`.
- **DTOs y validación**: `server/src/modules/<domain>/dto/`.
- **Schemas Mongoose**: `server/src/modules/<domain>/*.schema.ts`.
- **Controllers HTTP**: `server/src/modules/<domain>/*.controller.ts`.
- **Guards/filters/interceptors globales**: `server/src/core/`.
- **Utilidades compartidas**: `server/src/common/`.
- **UI por feature**: `client/src/app/features/<feature>/`.
- **Componentes/pipes compartidos**: `client/src/app/shared/`.
- **Servicios singleton y auth**: `client/src/app/core/`.

Antes de crear una carpeta o patrón, mira la estructura existente y el
`AGENTS.md` del workspace afectado. No añadas dependencias solo porque estén
en la visión del producto.

## Verificación

- `npm run lint` (ambos workspaces)
- `npm run typecheck -w server` / `npm run typecheck -w client`
- `npm run test -w server` / `npm run test -w client`
- `npm run test:integration -w server`
- `npm run test:e2e` (Playwright)
- `npm run build -w server` / `npm run build -w client`

Jest corre backend (default NestJS) y frontend. Integración usa
`mongodb-memory-server`. Playwright busca en `client/e2e/`. Ejecuta solo los
checks pertinentes y amplía la verificación según el alcance.
