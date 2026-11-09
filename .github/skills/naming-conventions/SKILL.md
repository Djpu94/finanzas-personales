---
name: naming-conventions
description: >
  Convenciones TypeScript, NestJS, Angular y archivos del monorepo de finanzas
  personales. Úsalo al crear módulos, componentes, controllers, services,
  schemas, DTOs, tests o al renombrar símbolos.
---

# Convenciones de nomenclatura

Respeta primero los nombres y patrones del directorio cercano. Convenciones
del proyecto:

| Elemento                                   | Convención                                          | Ejemplo                                                             |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------- |
| Variables y funciones                      | `camelCase`; funciones con verbo                    | `userId`, `loadTransactions()`                                      |
| Constantes de módulo estables              | `UPPER_SNAKE_CASE`                                  | `JWT_COOKIE_NAME`, `TRANSACTION_TYPES`                              |
| Clases, interfaces, tipos                  | `PascalCase`, interfaces sin prefijo `I`            | `Transaction`, `JwtPayload`, `AccountsService`                      |
| Enums y uniones discriminadas              | `PascalCase` (tipo) y `UPPER_SNAKE_CASE` (valores)  | `TransactionType.EXPENSE`, `'expense' \| 'income' \| 'transfer'`    |
| Componentes Angular                        | `PascalCase.ts` + sufijo `Component`                | `TransactionsListComponent`, `BudgetFormDialogComponent`            |
| Servicios Angular                          | `PascalCase.ts` + sufijo `Service` o `Store`        | `AccountsStoreService`, `ThemeService`, `ApiService`                |
| Guards / interceptors / pipes / directives | `PascalCase.ts` + sufijo funcional                  | `AuthGuard`, `AuthInterceptor`, `CurrencyCentsPipe`                 |
| Módulos Angular                            | `PascalCase.ts` + sufijo `Module`                   | `TransactionsModule`, `SharedModule`                                |
| Módulos NestJS                             | `kebab-case.ts` + sufijo `.module.ts`               | `transactions.module.ts`, `analytics.module.ts`                     |
| Controllers NestJS                         | `kebab-case.ts` + `.controller.ts`                  | `transactions.controller.ts`                                        |
| Services NestJS                            | `kebab-case.ts` + `.service.ts`                     | `transaction-query.service.ts`                                      |
| Schemas Mongoose                           | `kebab-case.ts` + `.schema.ts` (clase con `Schema`) | `transaction.schema.ts` → `class Transaction` / `TransactionSchema` |
| DTOs NestJS                                | `kebab-case.ts` + `.dto.ts` (clase con `Dto`)       | `create-transaction.dto.ts` → `CreateTransactionDto`                |
| Repositorios / providers custom            | `kebab-case.ts` + sufijo descriptivo                | `transaction-repository.ts`                                         |
| Tests unitarios (backend)                  | Nombre del archivo + `.spec.ts`                     | `transactions.service.spec.ts`                                      |
| Tests unitarios (frontend)                 | Nombre del archivo + `.spec.ts`                     | `transactions-list.component.spec.ts`                               |
| Tests de integración                       | Nombre + `.integration-spec.ts`                     | `transactions.repository.integration-spec.ts`                       |
| E2E (Playwright)                           | `kebab-case.spec.ts` en `client/e2e/`               | `transactions-flow.spec.ts`                                         |

## Detalles por capa

### Backend (NestJS + Mongoose)

- **Módulos por dominio**: `modules/<domain>/<domain>.module.ts`. Un módulo
  expone `exports` explícitos; no inyectes providers de otro módulo sin
  importarlo.
- **Controllers delgados**: `*.controller.ts` recibe DTO, delega al service,
  devuelve el resultado. Sin lógica de negocio.
- **Services por caso de uso**: si un service crece, divídelo
  (`transaction-creation.service.ts`, `transaction-query.service.ts`). No
  tengas un `transactions.service.ts` con 30 métodos.
- **DTOs con sufijo**: `CreateTransactionDto`, `UpdateTransactionDto`,
  `TransactionFilterDto`. Un archivo por DTO o un archivo agrupado por caso de
  uso (elige uno y sé consistente).
- **Schemas Mongoose**: archivo `*.schema.ts` con la clase decorada
  `@Schema()` y el `SchemaFactory.createForClass()`. El tipo TS se deriva del
  schema con `HydratedDocument<Transaction>`.
- **Nombres de campos en DB**: `camelCase` en el schema, con `userId`,
  `accountId`, `categoryId`, `targetAccountId`, `tagIds` (sufijo `Id`/`Ids`).
- **Constantes de canal/IPC**: no existen en este proyecto (no hay IPC). Las
  constantes de config van en `core/constants.ts` con `UPPER_SNAKE_CASE`.
- **Nombres de variables booleanas**: prefijos `is`, `has`, `can`, `should`
  (`isArchived`, `hasTransactions`, `canEdit`).
- **No abrevies en APIs públicas**: `transactionId` no `txId`,
  `categoryId` no `catId`.

### Frontend (Angular NgModules)

- **Un archivo por componente**: `feature/x.component.ts` junto a
  `x.component.html` y `x.component.scss` (si aplica).
- **Features**: `features/<feature>/` con subcarpetas `components/`, `pages/`,
  `services/`, `models/`, `<feature>.module.ts`,
  `<feature>-routing.module.ts`.
- **Models/interfaces**: `features/<feature>/models/<entity>.model.ts`. No
  importes modelos de otro feature directamente; si son compartidos, viven en
  `shared/models/`.
- **Stores con Signals**:
  `features/<feature>/services/<entity>-store.service.ts`
  (`AccountsStoreService`). Un store por agregado de UI, no un store global.
- **Signals con nombre semántico**: `accounts = signal<Account[]>([])`,
  `totalBalance = computed(...)`. No `data`/`items` genéricos.
- **Servicios de infraestructura** en `core/`: `AuthService`,
  `ApiService`, `ThemeService`, `LayoutService`.
- **Guards/interceptors/pipe/directives** en `core/` o `shared/` según
  dominio. Los funcionales (`CanActivateFn`, `HttpInterceptorFn`) son
  preferibles a clases en Angular moderno.

### Reglas transversales

- **No renombres archivos o exports públicos** como efecto colateral de un
  cambio. Si el renombre es necesario, actualiza imports y referencias y
  documenta el motivo en el commit.
- **No mezcles idiomas**: nombres de dominio en inglés (`Transaction`,
  `Account`, `Category`), textos UI en español. Los identificadores técnicos
  siguen la convención en inglés.
- **No añadas sufijos redundantes**: `AccountService` sí,
  `AccountServiceClass` no. `createAccount()` sí,
  `createAnAccountAction()` no.
- **Extensiones ESM**: los imports llevan `.js` en archivos que compila
  TypeScript a ESM (backend Node, configs); en Angular sigue la configuración
  del `tsconfig` (por defecto sin extensión). No mezcles estilos en el mismo
  workspace.
