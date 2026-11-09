---
name: testability
description: >
  Diseño verificable con Jest y Playwright en la app de finanzas personales.
  Úsalo al implementar dominio, persistencia Mongoose, controllers, services,
  guards, componentes Angular o flujos del renderer.
---

# Testabilidad

## Diseña alrededor de contratos

- Mantén la **lógica de negocio pura** en services cuando sea posible; evita
  que dependa de Mongoose, `HttpClient` o el DOM.
- Inyecta dependencias externas (repositorios, servicios) por constructor en
  NestJS o `inject()` en Angular. No instancies dependencias dentro de la
  lógica.
- Prueba el **comportamiento observable** del contrato (entradas → salidas,
  llamadas a repositorio), no detalles privados ni implementación interna.
- Para Mongoose, aísla el repository de la lógica de negocio: el service
  recibe el `Model` inyectado y se testea con un mock del modelo, no con una
  DB real. Los pipelines complejos (analytics) sí se testean contra
  `mongodb-memory-server`.

## Pruebas por capa

| Área                                              | Herramienta                  | Validación preferida                                          | Convención                              |
| ------------------------------------------------- | ---------------------------- | ------------------------------------------------------------- | --------------------------------------- |
| `server/src/modules/*` (services)                 | Jest                         | Unitarias con mocks del `Model` y de otros services           | `*.service.spec.ts` junto al código     |
| `server/src/core` (guards, filters, interceptors) | Jest                         | Unitarias con mocks de `ExecutionContext`                     | `*.spec.ts` junto al código             |
| `server/src/modules/*` (integration)              | Jest + mongodb-memory-server | Repositorios, índices, pipelines de aggregation               | `*.integration-spec.ts` junto al código |
| `client/src/app/features/*` (stores)              | Jest                         | Signals, computed, llamadas a `ApiService` mockeado           | `*.store.spec.ts` junto al código       |
| `client/src/app/features/*` (components)          | Jest                         | Render con `TestBed`, `ComponentFixture`, interacción con DOM | `*.component.spec.ts` junto al código   |
| `client/e2e`                                      | Playwright                   | Flujos de usuario completos contra la app + backend real      | `*.spec.ts` en `client/e2e/`            |

**Jest** corre en backend (default NestJS) y frontend (configurado en
`client/jest.config.ts`; se prefiere Jest sobre Karma para unificar runner).
Si el proyecto usa Karma/Jasmine por defecto en Angular, adapta las
convenciones de archivo (`*.spec.ts`) pero mantén la lógica descrita aquí.
Playwright usa `npm run test:e2e`.

## MongoDB y transacciones

- En tests unitarios de services, mockea el `Model` con `jest.fn()` para
  `find`, `findOne`, `create`, `updateOne`, `deleteOne`, `aggregate`.
- En tests de integración, usa `mongodb-memory-server` con base temporal por
  suite (`beforeAll`/`afterAll`) y datos semilla por test (no estado
  compartido entre tests).
- Prueba índices únicos (ej. `userId + categoryId + period` en Budgets) con
  el error real de Mongo (E11000) para asegurar que el service lo traduce a
  `ConflictException`.
- Para los pipelines de `analytics`, valida contra datos semilla conocidos:
  un ingreso + un gasto + una transferencia → `netWorth`, `monthlyIncome`,
  `monthlyExpense` deben ser exactos. La transferencia no suma ni resta.
- **No compartas estado entre tests** ni dependas del orden de ejecución.

## Contratos y fallos

- En **NestJS**, comprueba el código de estado HTTP y el cuerpo de error
  `{ statusCode, message, error }`. Verifica el happy path y los códigos
  relevantes (400, 401, 403, 404, 409, 500).
- En **DTOs**, prueba entradas válidas, límites (`min`, `max`, `length`) y
  formas inválidas (`@IsUUID()`, `@IsEnum()`, `@IsPositive()`).
- En **Angular**, verifica:
  - El componente renderiza el estado vacío, loading y error (no solo el
    happy path).
  - El submit del formulario deshabilita el botón mientras está pending y lo
    rehabilita al terminar.
  - Un error del backend se muestra en `MatSnackBar` y el borrador del
    formulario se conserva.
  - Los diálogos devuelven el resultado esperado y cierran por `Escape`.
- Prefiere **fakes que cumplan el contrato** (un `ApiService` fake con las
  mismas firmas) sobre mocks globales.

## Anti-patrones prohibidos

- No desactives tests ni TypeScript para lograr verde.
- No introduzcas `any`, `@ts-ignore` ni `eslint-disable` para evitar
  comprender el error.
- No añadas una librería de testing nueva (Testing Library, Cypress) sin
  decisión explícita: el stack ya cubre los casos.
- No ejecutes Playwright para lo que un unit test cubre; reserva e2e para
  flujos críticos (login → crear transacción → ver dashboard).

## Comandos de referencia

- `npm run lint` (ambos workspaces)
- `npm run typecheck -w server` / `npm run typecheck -w client`
- `npm run test -w server` / `npm run test -w client`
- `npm run test -w server -- transaction.service.spec.ts` (un archivo)
- `npm run test:integration -w server`
- `npm run test:e2e` (Playwright)

Antes de crear un test nuevo, revisa los tests cercanos y la configuración
raíz para conservar sus convenciones.
