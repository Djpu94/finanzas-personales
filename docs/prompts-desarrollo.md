# Prompts de desarrollo — App de finanzas personales

Lista de 20 prompts para construir la aplicación por fases. Cada prompt asume que los anteriores están completos y verificados.

Antes de usar cualquier prompt, Copilot debe seguir las skills del proyecto en `.github/skills/` (`project-context`, `naming-conventions`, `type-safety`, `error-handling`, `testability`, `observability-logging`, `angular-ui-design`, `anti-agentic-loop`).

## Cómo usar esta lista

1. Copia un prompt a la vez en Copilot Chat (o Copilot Edits) en el orden indicado.
2. Verifica los criterios de aceptación antes de pasar al siguiente.
3. Si Copilot se desvía de la arquitectura (NgRx, standalone components, microservicios), detenlo y pide que siga las restricciones del prompt.
4. Haz commit al terminar cada prompt con el mensaje `feat(modulo): descripción`.
5. No saltes de fase hasta completar la anterior.

## Orden de dependencias

```
1. Scaffolding
 └─ 2. Auth backend
     └─ 3. Auth frontend
         └─ 4. Layout Material
             └─ 5. Accounts backend
                 └─ 6. Categories backend
                     └─ 7. Transactions backend
                         └─ 8. Accounts frontend
                             └─ 9. Categories frontend
                                 └─ 10. Transactions frontend
                                     └─ 11. Analytics backend
                                         └─ 12. Dashboard frontend
                                             └─ 13. Budgets backend
                                                 └─ 14. Budgets frontend
                                                     └─ 15. Reports (CSV/PDF)
                                                         └─ 16. Dark mode
                                                             └─ 17. PWA
                                                                 └─ 18. Import CSV
                                                                     └─ 19. Zen mode
                                                                         └─ 20. Pulido final
```

---

## FASE 0 — Cimientos (infraestructura y autenticación)

### Prompt 1 — Scaffolding del monorepo (backend + frontend)

```
CONTEXTO:
Estoy construyendo una app de finanzas personales full-stack para uso individual y portafolio. Stack decidido:
- Backend: NestJS + MongoDB + Mongoose (monolito modular por dominio)
- Frontend: Angular (NgModules, NO standalone) + Angular Material + Signals + Chart.js
- Auth: JWT en cookie HttpOnly + Secure
- Persistencia: MongoDB

OBJETIVO:
Crea la estructura inicial del monorepo con dos carpetas raíz: `client/` (Angular) y `server/` (NestJS). Incluye configuración compartida de TypeScript, ESLint, Prettier, .gitignore y scripts raíz con npm workspaces para ejecutar ambos en paralelo.

RESTRICCIONES:
- No uses Nx (prefiero simplicidad para una persona).
- Configura `concurrently` en el package.json raíz para `npm run dev`.
- El `server` debe escuchar en 3000 y el `client` en 4200 con proxy de Angular hacia `/api`.
- Incluye variables de entorno `.env.example` en server (MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET, COOKIE_DOMAIN, NODE_ENV).

ESTRUCTURA ESPERADA EN server/src:
core/ (filters, guards, interceptors), common/ (decorators, dto, utils), modules/ (auth, users, accounts, transactions, categories, budgets, analytics), app.module.ts, main.ts.

CRITERIOS DE ACEPTACIÓN:
- `npm run dev` levanta backend y frontend simultáneamente.
- El frontend puede hacer GET a `/api/health` y recibir `{ status: 'ok' }` desde el backend vía proxy.
- Ambos proyectos compilan sin errores con `npm run build`.
```

---

### Prompt 2 — Módulo Auth backend (registro + login + JWT en cookie HttpOnly)

```
CONTEXTO:
Monolito modular NestJS con estructura: src/core, src/common, src/modules. Aún no existe ningún módulo de negocio. Vamos a crear el módulo `auth` como base de seguridad de toda la app.

OBJETIVO:
Implementa el módulo `auth` completo con:
1. Registro de usuario (email único, password hasheado con bcrypt, nombre).
2. Login que valide credenciales y emita:
   - access token JWT (15 min) en cookie HttpOnly, Secure, SameSite=Lax.
   - refresh token JWT (7 días) en cookie HttpOnly con path `/api/auth/refresh`.
3. Endpoint `/api/auth/refresh` que rote el refresh token.
4. Endpoint `/api/auth/logout` que limpie ambas cookies.
5. Endpoint `/api/auth/me` protegido que devuelva el usuario actual.

RESTRICCIONES:
- Usa `@nestjs/passport` + `passport-jwt` con una estrategia que lea el token **desde la cookie**, no del header Authorization.
- Usa `class-validator` y `class-transformer` en todos los DTOs.
- Implementa `JwtAuthGuard` global en `core/guards` con decorador `@Public()` para excluir rutas.
- Servicios por caso de uso: `AuthRegisterService`, `AuthLoginService`, `TokenService`.
- Los usuarios se guardan en el módulo `users` (crea la entidad y el servicio básico ahí; auth solo lo consume).
- No devuelvas nunca el hash de la contraseña en las respuestas (usa un `UserResponseDto`).
- Configura CORS con `credentials: true` y el origen del frontend.

CRITERIOS DE ACEPTACIÓN:
- `POST /api/auth/register` crea usuario y responde 201.
- `POST /api/auth/login` responde 200 y setea cookies correctamente (verificable en DevTools).
- `GET /api/auth/me` sin cookie responde 401; con cookie responde el usuario.
- Los tests unitarios de `AuthLoginService` (credenciales inválidas / válidas) pasan.
```

---

### Prompt 3 — Módulo Auth frontend (login/registro + CoreModule)

```
CONTEXTO:
Angular con NgModules (NO standalone). Backend NestJS ya expone /api/auth/register, /login, /refresh, /logout, /me con cookies HttpOnly. Sistema de diseño: Angular Material. Estado: Signals.

OBJETIVO:
1. Crea `CoreModule` en `src/app/core/` con:
   - `AuthService` (Signals: `currentUser`, `isAuthenticated`; métodos register/login/logout/refresh).
   - `AuthInterceptor` funcional que añada `withCredentials: true` a todas las peticiones y capture 401 para intentar refresh una vez antes de redirigir a login.
   - `AuthGuard` y `GuestGuard` funcionales.
   - `ApiService` wrapper de HttpClient con base URL `/api`.
2. Crea `AuthModule` en `src/app/features/auth/` con lazy loading (`loadChildren`).
   - `LoginComponent` y `RegisterComponent` usando Angular Material (`mat-form-field`, `mat-input`, `mat-card`, `mat-button`).
   - Reactive forms con validación (email, password min 8, match de passwords en registro).
   - Manejo de estados: loading (spinner en botón), error (mat-snack-bar o mat-error inline).

RESTRICCIONES:
- No uses NgRx. Estado global mínimo con Signals en `AuthService`.
- `ChangeDetectionStrategy.OnPush` en todos los componentes.
- No almacenes tokens en localStorage ni sessionStorage (backend los maneja en cookies).
- Usa `provideHttpClient(withInterceptors([authInterceptor]))` en `AppModule`.

CRITERIOS DE ACEPTACIÓN:
- Al hacer login exitoso, redirige a `/dashboard`.
- Al recargar la app, `AuthService` llama a `/me` en un `APP_INITIALIZER` y restaura sesión.
- Si expira la sesión y falla el refresh, redirige a `/login`.
- Los formularios muestran errores inline en Material.
```

---

### Prompt 4 — Layout base con Angular Material (shell + navegación)

```
CONTEXTO:
App Angular con AuthModule funcional y AuthGuard protegiendo rutas privadas. Necesitamos el shell visual donde vivirá el resto de la app.

OBJETIVO:
Crea el `LayoutModule` (en `features/layout/`) con:
- `MainLayoutComponent` con:
  - `mat-sidenav` colapsable (modo `side` en desktop, `over` en móvil).
  - `mat-toolbar` con: logo/nombre de la app, botón hamburguesa, menú de usuario (avatar con mat-menu: perfil, logout).
  - `router-outlet` en el área de contenido.
- `SidenavMenuComponent` con ítems: Dashboard, Transacciones, Cuentas, Categorías, Presupuestos. Cada uno con `mat-icon` y `routerLink` con `routerLinkActive`.
- Rutas protegidas por `AuthGuard`: `/dashboard`, `/transactions`, `/accounts`, `/categories`, `/budgets`. Por ahora cada feature devuelve un placeholder (componente simple "En construcción").
- Un tema Angular Material personalizado (paleta primaria personalizada, tipografía Inter). Define los colores CSS base en `styles.scss`.

RESTRICCIONES:
- Usa `BreakpointObserver` de `@angular/cdk` para cambiar entre modo `side` y `over`.
- El sidenav debe recordar el estado (abierto/cerrado) en un `LayoutService` con Signals.
- No mezcles lógica de negocio aquí; solo navegación y presentación.
- `ChangeDetectionStrategy.OnPush` en todos los componentes.

CRITERIOS DE ACEPTACIÓN:
- En desktop se ve sidebar fijo; en móvil, se abre como overlay con backdrop.
- Cada ítem del menú navega a su ruta y se marca como activo.
- El botón de logout llama a `AuthService.logout()` y redirige a `/login`.
```

---

## FASE 1 — Núcleo transaccional

### Prompt 5 — Módulo Accounts backend (CRUD de cuentas/fondos)

```
CONTEXTO:
Backend NestJS con módulo auth funcional y JwtAuthGuard global. Estructura modular: src/modules/accounts. Cada entidad siempre pertenece a un userId (multi-usuario en la misma DB).

OBJETIVO:
Implementa el módulo `accounts` completo con:
- Modelo Account: { userId, name, type ('checking' | 'savings' | 'cash' | 'credit_card'), initialBalance (number, en centavos), currency (ISO 4217, default 'EUR'), isArchived (boolean, default false) }.
- Endpoints:
  - GET /api/accounts (lista del usuario autenticado, con filtro `?includeArchived=true`)
  - POST /api/accounts
  - PATCH /api/accounts/:id
  - DELETE /api/accounts/:id (soft delete -> isArchived=true)
- `AccountsService` con `findAllByUser(userId)`, `findOneByUser(userId, id)`, `create`, `update`, `archive`.
- DTOs con class-validator (`CreateAccountDto`, `UpdateAccountDto`).
- Índice compuesto en MongoDB: { userId: 1, isArchived: 1 }.

RESTRICCIONES:
- Todos los métodos reciben `userId` desde `@CurrentUser()` del decorador.
- Nunca permitas leer/modificar cuentas de otro usuario (filtro obligatorio por userId en la query).
- Controladores delgados: solo reciben DTO + userId y delegan al servicio.
- Tests unitarios del servicio con mocks del repositorio Mongoose.

CRITERIOS DE ACEPTACIÓN:
- Un usuario solo ve sus propias cuentas.
- DELETE archiva (no borra) y la cuenta deja de aparecer en el listado por defecto.
- Los tests unitarios del servicio cubren create, update, archive y el filtrado por userId.
```

---

### Prompt 6 — Módulo Categories backend (jerarquía + etiquetas)

```
CONTEXTO:
Backend NestJS con módulos auth y accounts funcionales. Necesitamos categorías jerárquicas (ej. Alimentación > Supermercado) y etiquetas libres.

OBJETIVO:
Implementa el módulo `categories` con dos sub-entidades:

1. Categorías jerárquicas:
- Modelo Category: { userId, name, parentId (ObjectId | null), type ('income' | 'expense'), color (hex string), icon (string opcional) }.
- Endpoints: GET /api/categories (árbol o lista plana con ?format=tree|flat), POST, PATCH, DELETE.
- DELETE debe fallar si la categoría tiene hijos o transacciones asociadas; devuelve 409 con mensaje claro.

2. Etiquetas:
- Modelo Tag: { userId, name, color }.
- Endpoints: GET /api/tags, POST, DELETE.

RESTRICCIONES:
- Prevención de ciclos: al actualizar `parentId`, verifica que el nuevo padre no sea descendiente del nodo que se mueve.
- Índices: { userId: 1, parentId: 1 } y { userId: 1, name: 1 } (unique) para Category y Tag.
- El endpoint GET /api/categories?format=tree debe devolver la estructura anidada con `children`.
- DTOs estrictos + tests unitarios del servicio (incluye test del caso de ciclos).

CRITERIOS DE ACEPTACIÓN:
- No se puede crear dos categorías con el mismo nombre en el mismo nivel (mismo parentId).
- El árbol se construye correctamente con más de 2 niveles.
- El test que intenta crear un ciclo falla con error explícito.
```

---

### Prompt 7 — Módulo Transactions backend (CRUD + transferencias + filtros)

```
CONTEXTO:
Backend NestJS con módulos auth, accounts, categories y tags funcionales. `transactions` es la entidad central y la que más consultas tendrá (dashboard, filtros, budgets).

OBJETIVO:
Implementa el módulo `transactions` completo:

Modelo Transaction:
{ userId, type ('income' | 'expense' | 'transfer'), amount (centavos, integer >= 0), date (Date), description (string, max 500), accountId (ObjectId, ref Account), targetAccountId (ObjectId | null, solo si type='transfer'), categoryId (ObjectId | null, no aplica en transfer), tagIds (ObjectId[]), notes (string opcional) }

Endpoints:
- GET /api/transactions con query params: `from`, `to`, `accountId`, `categoryId`, `tagId`, `type`, `search` (regex sobre description), `page`, `pageSize`, `sortBy`, `sortOrder`. Respuesta paginada: { data, total, page, pageSize }.
- POST /api/transactions
- GET /api/transactions/:id
- PATCH /api/transactions/:id
- DELETE /api/transactions/:id

Lógica de transferencia:
- Crear una transferencia genera UN documento en DB (no dos) con accountId (origen) y targetAccountId (destino). El cálculo de saldos lo hará el módulo de analytics/accounts al vuelo.

RESTRICCIONES:
- Índice compuesto obligatorio: { userId: 1, date: -1 } y { userId: 1, accountId: 1, date: -1 }.
- El filtro `search` usa regex case-insensitive sobre `description`.
- No permitas asociar una transacción de tipo `transfer` a una `categoryId`.
- No permitas transferencias a la misma cuenta de origen.
- Paginación por defecto: page=1, pageSize=20 (max 100).
- Tests unitarios: crear income/expense/transfer, validaciones y filtros.

CRITERIOS DE ACEPTACIÓN:
- GET con filtros de fecha + account + type devuelve el subconjunto correcto.
- POST de transfer a la misma cuenta responde 400.
- Los tests cubren los 3 tipos de transacción y la paginación.
```

---

### Prompt 8 — Módulo Accounts frontend (lista + formulario)

```
CONTEXTO:
Angular NgModules con CoreModule, LayoutModule y AuthModule completos. Backend /api/accounts listo. Angular Material como sistema de diseño. Signals para estado.

OBJETIVO:
Crea `AccountsModule` (lazy) en `features/accounts/` con:
- `AccountsStoreService` (Signals): `accounts = signal<Account[]>`, `loading`, `error`; métodos `load()`, `create()`, `update()`, `archive()`.
- `AccountsListComponent`: grid de tarjetas Material (`mat-card`) mostrando nombre, tipo (icono), saldo inicial, moneda. Botón "Nueva cuenta". Acciones por tarjeta: editar, archivar.
- `AccountFormComponent` (mat-dialog): reactive form con name (required), type (mat-select), initialBalance (number), currency (mat-select de 3-4 opciones).
- Empty state: cuando no hay cuentas, mostrar ilustración/mensaje + CTA "Añade tu primera cuenta".

RESTRICCIONES:
- Modelos TypeScript en `features/accounts/models/account.model.ts`.
- El `initialBalance` se envía al backend en centavos (multiplica *100 al enviar, divide /100 al mostrar). Crea un pipe `CurrencyCentsPipe` en `shared/pipes/`.
- `ChangeDetectionStrategy.OnPush` + signals para reactividad.
- No uses ngModel; todo reactive forms.

CRITERIOS DE ACEPTACIÓN:
- Crear una cuenta nueva la refleja al instante en la lista (Signal reactivo).
- El saldo se muestra formateado con el locale correcto.
- Archivar una cuenta la quita del listado sin recargar.
```

---

### Prompt 9 — Módulo Categories frontend (árbol + etiquetas)

```
CONTEXTO:
Igual que el prompt anterior. Backend /api/categories y /api/tags listos. Necesitamos una UI que permita ver el árbol de categorías y gestionar etiquetas.

OBJETIVO:
Crea `CategoriesModule` (lazy) con dos pestañas (`mat-tab-group`):

Pestaña 1 — Categorías:
- `CategoriesStoreService` con Signals para árbol (`categoriesTree`) y lista plana.
- `CategoriesTreeComponent`: usa `mat-tree` con expand/collapse. Cada nodo muestra nombre + icono + color + acciones (editar, eliminar).
- `CategoryFormDialogComponent`: form con name, parentId (mat-select con indentación visual, opción "Sin padre"), type (income/expense), color picker simple (input type=color).

Pestaña 2 — Etiquetas:
- `TagsListComponent` con chips (`mat-chip-set`) por etiqueta.
- Formulario inline o dialog para crear/eliminar tags.

RESTRICCIONES:
- El select de "parentId" debe excluir el propio nodo y sus descendientes (para evitar ciclos en UI).
- Usa `MatTreeFlatDataSource` con flat data + `buildFileTree` helper.
- Empty states en ambas pestañas.

CRITERIOS DE ACEPTACIÓN:
- El árbol expande/colapsa y persiste el estado visual al navegar.
- Al intentar crear una categoría con el mismo nombre bajo el mismo padre, muestra error 409 del backend de forma legible.
```

---

### Prompt 10 — Módulo Transactions frontend (lista + formulario + filtros básicos)

```
CONTEXTO:
Backend /api/transactions con paginación y filtros listo. Módulos accounts y categories ya existen en frontend con sus stores. Ahora la pantalla más importante para el uso diario.

OBJETIVO:
Crea `TransactionsModule` (lazy) con:

1. `TransactionsStoreService` con Signals:
   - `transactions`, `total`, `page`, `pageSize`, `filters` (signal con objeto de filtros activos), `loading`, `error`.
   - Métodos: `load(filters)`, `create()`, `update()`, `delete()`.

2. `TransactionsListComponent`:
   - `mat-table` con columnas: fecha, descripción, categoría (chip con color), cuenta, monto (verde ingreso / rojo gasto), acciones.
   - Paginación con `mat-paginator` sincronizada con backend.
   - Barra de filtros superior: `mat-date-range-input` (rango), `mat-select` de cuenta, `mat-select` de categoría, `mat-select` de tipo, `input` de búsqueda con debounce 300ms.
   - Botón "Nueva transacción" (FAB o botón primario).
   - Empty state cuando no hay resultados (diferenciar entre "sin transacciones" y "sin resultados para estos filtros").

3. `TransactionFormDialogComponent` (mat-dialog, ancho):
   - Form con: type (toggle group income/expense/transfer), amount, date, description, accountId, categoryId (oculto si transfer), targetAccountId (solo si transfer), tagIds (chips multi-select), notes.
   - Validación condicional según type.

RESTRICCIONES:
- Los filtros se reflejan en la URL con `queryParams` (compartir enlace con filtros aplicados).
- Reutiliza `CurrencyCentsPipe` de shared.
- `ChangeDetectionStrategy.OnPush` y `trackBy` en la tabla.
- Debounce en búsqueda con `toSignal` o `debounceTime`.

CRITERIOS DE ACEPTACIÓN:
- Cambiar cualquier filtro recarga la tabla desde el backend (no filtro en cliente).
- La URL refleja los filtros aplicados y al recargar la página se mantienen.
- Crear/editar/borrar una transacción actualiza la tabla sin recargar la página.
- La paginación funciona con el backend.
```

---

## FASE 2 — Dashboard y analítica

### Prompt 11 — Módulo Analytics backend (agregaciones)

```
CONTEXTO:
Backend NestJS con transactions, accounts, categories y tags funcionales. Necesitamos un módulo `analytics` que sirva los KPIs y series temporales para el dashboard. Puede leer directamente de los modelos (no es dueño de entidades).

OBJETIVO:
Implementa el módulo `analytics` con un solo endpoint de "overview" y otro de "series":

1. GET /api/analytics/overview?month=YYYY-MM
Devuelve:
{
  netWorth: number,              // suma de initialBalance + ingresos - gastos por cuenta, excluyendo transferencias
  monthlyIncome: number,
  monthlyExpense: number,
  monthlyBalance: number,
  variationVsPreviousMonth: number, // % de cambio del balance respecto al mes anterior
  topExpenseCategories: [{ categoryId, name, total }], // top 5
  budgetAlerts: [...] // se completa en Fase 3, por ahora []
}

2. GET /api/analytics/series?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|month
Devuelve:
{
  cashFlow: [{ date, income, expense }],
  categoryDistribution: [{ categoryId, name, total }],
  netWorthEvolution: [{ date, netWorth }]
}

RESTRICCIONES:
- Usa el Aggregation Framework de MongoDB con `$match` por userId primero (obligatorio).
- Las transferencias NO cuentan como ingreso ni gasto (se excluyen en las sumas).
- Para `netWorthEvolution`, calcula incrementalmente (saldo inicial + suma acumulada).
- Cachea en memoria (`@nestjs/cache-manager` con TTL 60s) por userId+params, porque es costoso y se llama seguido.
- Tests unitarios de los pipelines (usa mongodb-memory-server o mocks del Aggregate).

CRITERIOS DE ACEPTACIÓN:
- El overview devuelve números consistentes con los datos de prueba.
- La serie diaria/mensual rellena días sin movimientos con 0 (no gaps).
- Un usuario sin transacciones devuelve ceros sin errores.
```

---

### Prompt 12 — Dashboard frontend (KPIs + gráficos + estados vacíos)

```
CONTEXTO:
Backend /api/analytics/overview y /series listos. Angular Material + Chart.js. Feature module ya scaffolded como placeholder. Este es el diferenciador del producto: prioriza claridad y jerarquía visual.

OBJETIVO:
Reemplaza el placeholder de `DashboardModule` con la pantalla de inicio. Estructura visual (de arriba a abajo):

1. "Verdict Row" (above the fold):
- Un `mat-card` dominante con: número grande en `Inter` o `Roboto Mono` (font-feature-settings 'tnum') mostrando el **patrimonio neto**.
- Debajo: variación % vs mes anterior con flecha ↑/↓ y color (verde/rojo).
- Al lado: 2 sub-KPIs compactos (ingresos del mes, gastos del mes).

2. Zona "Flujo" — gráfico de líneas con Chart.js:
- `cashFlow` (income vs expense en el tiempo). Dos datasets. Sin animación al cambiar filtros.

3. Zona "Distribución" — doughnut Chart.js:
- Distribución de gastos por categoría. Paleta derivada de colores de categorías.

4. Zona "Atención" (placeholder por ahora):
- Mat-card con mensaje "Configura tus presupuestos para ver alertas aquí" + botón a /budgets.

5. Zona "En movimiento":
- Lista compacta de las últimas 5 transacciones (reutiliza un componente de transactions).

Selector de mes arriba (mat-button-toggle con ← mes →).

RESTRICCIONES:
- Componentes individuales por zona (`VerdictRowComponent`, `CashFlowChartComponent`, `CategoryDonutComponent`, `RecentTransactionsComponent`), todos con `OnPush`.
- Charts en `<canvas>` con `Chart.js` versión 4; crea `ChartContainerDirective` para gestionar el ciclo de vida y destruir charts en `ngOnDestroy`.
- Tipografía tabular para todos los números grandes.
- Loading skeletons (`mat-progress-bar` o skeleton CSS) mientras cargan los datos.
- **Empty state crítico**: si el usuario no tiene transacciones, mostrar un onboarding inline: "Aún no tienes datos. Añade tu primera transacción" + CTA.

CRITERIOS DE ACEPTACIÓN:
- La pantalla responde de un vistazo a: ¿cuál es mi saldo?, ¿cuánto ingresé/gasté este mes?, ¿cómo voy vs el mes anterior?
- Cambiar el mes recarga solo los datos (no la página completa).
- Los charts se destruyen correctamente al salir del dashboard (sin leaks).
- Con 0 transacciones el empty state aparece en lugar de gráficos vacíos.
```

---

## FASE 3 — Presupuestos y reportes

### Prompt 13 — Módulo Budgets backend

```
CONTEXTO:
Backend NestJS con analytics funcional. Ahora implementamos presupuestos por categoría/mes.

OBJETIVO:
Implementa el módulo `budgets`:

Modelo Budget:
{ userId, categoryId (ObjectId), period ('YYYY-MM'), limitAmount (centavos), alertsEnabled (bool) }

Endpoints:
- GET /api/budgets?period=YYYY-MM → devuelve budgets + `spent` y `percentage` calculados en el momento consultando transactions.
- POST /api/budgets
- PATCH /api/budgets/:id
- DELETE /api/budgets/:id
- GET /api/budgets/alerts → devuelve presupuestos que superan 80% y 100% del límite.

RESTRICCIONES:
- Unicidad: un solo budget por (userId, categoryId, period). Índice único.
- El cálculo de `spent` suma solo `expense` del periodo y de esa categoría (incluyendo subcategorías hijas si las hay).
- Integra los alerts en el endpoint `/analytics/overview` (rellena el campo `budgetAlerts` que dejamos vacío).
- Tests unitarios de cálculo con y sin subcategorías.

CRITERIOS DE ACEPTACIÓN:
- Crear dos budgets para la misma categoría+periodo responde 409.
- El listado calcula `percentage` correctamente.
- El overview devuelve `budgetAlerts` con los presupuestos al 80%+.
```

---

### Prompt 14 — Módulo Budgets frontend

```
CONTEXTO:
Backend /api/budgets listo e integrado en overview. Angular Material.

OBJETIVO:
Crea `BudgetsModule` (lazy) con:
- `BudgetsStoreService` con Signals.
- `BudgetsOverviewComponent`: selector de mes + grid de `mat-card` (una por budget) con:
  - Nombre de categoría + su color.
  - `mat-progress-bar` con `value = percentage`; color dinámico (verde <80%, ámbar 80-100%, rojo >100%).
  - Texto: "Gastado X de Y (Z%)".
- `BudgetFormDialogComponent`: selección de categoría (solo expense), monto límite, periodo (mat-datepicker reducido a mes).
- Integrar en Dashboard: la "Zona Atención" (Prompt 12) ahora debe mostrar los budgets con alertas.

RESTRICCIONES:
- Reutilizar `CurrencyCentsPipe`.
- La progresión visual debe ser comprensible sin necesidad de leer el número (color + barra).
- `OnPush` + signals.

CRITERIOS DE ACEPTACIÓN:
- Crear/editar/eliminar presupuesto actualiza la lista sin recargar.
- El color de la barra cambia según el porcentaje.
- La zona "Atención" del dashboard refleja los presupuestos excedidos.
```

---

### Prompt 15 — Exportación de reportes (CSV + PDF)

```
CONTEXTO:
Backend NestJS con transactions, analytics, accounts y budgets funcionales. El frontend tiene dashboard y listados.

OBJETIVO:
1. Backend — Endpoint GET /api/reports/monthly?period=YYYY-MM&format=csv|pdf:
   - CSV: columnas `date,type,description,amount,account,category,tags`. Streaming con `csv-stringify`.
   - PDF: usar `pdfmake` en el servidor. Estructura mínima: título "Reporte {mes}", resumen (ingresos, gastos, balance), tabla de transacciones, gráficos opcionales (opcional para v2).

2. Frontend — Botón "Exportar" (mat-menu con dos opciones) en el `TransactionsListComponent` y en el `DashboardComponent`.
   - Descarga vía Blob + `createObjectURL`.

RESTRICCIONES:
- El nombre del archivo sigue el patrón `reporte-YYYY-MM.csv` / `reporte-YYYY-MM.pdf`.
- La generación de PDF se hace en el backend (no sobrecargar el cliente).
- Autenticación aplicada a estos endpoints (cookie HttpOnly funciona).
- Tests e2e del endpoint CSV (al menos el happy path).

CRITERIOS DE ACEPTACIÓN:
- Descarga CSV abre correctamente en Excel/Sheets con encoding UTF-8 (BOM).
- El PDF es legible y con el resumen en la primera página.
- Un usuario sin transacciones ese mes obtiene un CSV con solo cabeceras (no error).
```

---

## FASE 4 — Pulido y producto

### Prompt 16 — Modo oscuro con Angular Material

```
CONTEXTO:
Angular Material con tema personalizado claro. Todos los features implementados. Queremos toggle de modo oscuro con persistencia local.

OBJETIVO:
- Define dos temas Material con `mat.define-light-theme` y `mat.define-dark-theme` usando las mismas paletas.
- Crea `ThemeService` (Signals): `currentTheme: 'light' | 'dark' | 'system'`, método `setTheme()`.
- El servicio guarda la preferencia en `localStorage` (esto SÍ en localStorage, es preferencia de UI).
- Detecta `prefers-color-scheme` para el modo 'system'.
- Añade un botón en la toolbar (icono sol/luna) con `mat-menu` para elegir.
- Aplica la clase `dark-theme` al `<body>` y usa los mixins de Angular Material para que todos los componentes hereden.

RESTRICCIONES:
- Ajusta manualmente los colores de Chart.js según el tema (los charts no heredan CSS): escucha cambios de tema y actualiza `Chart.defaults.color`.
- Verifica contraste WCAG AA en textos principales.
- Sin flash de tema incorrecto al cargar (aplica la clase antes del bootstrap en `index.html` con script inline).

CRITERIOS DE ACEPTACIÓN:
- Cambiar de tema se refleja al instante en toda la app (Material + charts + custom CSS).
- La preferencia persiste al recargar.
- En modo 'system', cambiar el tema del SO cambia la app en vivo.
```

---

### Prompt 17 — PWA (instalable + offline básico)

```
CONTEXTO:
App Angular con todos los features. Queremos que sea instalable y consultable offline para saldos.

OBJETIVO:
- Añade `@angular/pwa` con `ng add @angular/pwa`.
- Configura `ngsw-config.json`:
  - `assetGroups`: precachea shell y assets estáticos.
  - `dataGroups`:
    - `/api/analytics/overview` con estrategia `freshness` TTL 1h (para consultar saldos offline).
    - `/api/transactions` con `performance` (cache-first para últimas listas).
    - Excluye `/api/auth/*` de caché.
- Añade íconos PWA personalizados (192, 512, maskable) con la identidad de la app.
- Personaliza `manifest.webmanifest`: name, short_name, theme_color, background_color, display 'standalone'.
- Muestra un banner "Instala la app" si el navegador soporta `beforeinstallprompt`.

RESTRICCIONES:
- No caches respuestas autenticadas por más de 1h (evita mostrar datos obsoletos como frescos).
- Respeta `HttpOnly` cookies (el service worker no las puede leer, perfecto).
- Añade una página simple `/offline` que se muestre si falla la red.

CRITERIOS DE ACEPTACIÓN:
- Lighthouse PWA pasa.
- Instalable en Chrome/Android.
- Con DevTools en modo offline, el overview con datos cacheados se muestra con banner "Datos sin conexión".
```

---

### Prompt 18 — Importación de transacciones desde CSV

```
CONTEXTO:
Backend NestJS + frontend Angular con todos los módulos. Feature de alto valor: importar extractos bancarios en CSV.

OBJETIVO:
Flujo de 3 pasos en un wizard (mat-stepper):

1. **Upload**: dropzone + input file (`.csv`, `.xlsx`). Solo `.csv` en v1. Parseo en cliente con `papaparse`.
2. **Mapeo de columnas**: UI donde el usuario asigna columnas del CSV a campos de la app: fecha, descripción, monto, tipo (o columna separada ingreso/gasto). Incluye preview de las primeras 5 filas. Detección automática de encoding y separador.
3. **Revisión y confirmación**: tabla de transacciones a importar con la cuenta/categoría por defecto seleccionable. Botón "Importar" llama a `POST /api/transactions/bulk` con array.

Backend:
- Nuevo endpoint `POST /api/transactions/bulk` que acepte array de transacciones, valide todo con un DTO array, y las inserte en una sola operación (`insertMany` con `ordered: false`). Devuelve { inserted, failed, errors }.

RESTRICCIONES:
- El paso 2 debe permitir guardar el mapeo en localStorage por huella del CSV (mismas columnas), para reutilizar en futuras importaciones.
- El parseo de fechas acepta múltiples formatos (ISO, DD/MM/YYYY, MM/DD/YYYY) detectando automáticamente.
- El backend NO debe romperse si una transacción falla: usa `ordered: false` y reporta los fallos.

CRITERIOS DE ACEPTACIÓN:
- Subir un CSV de 100 transacciones funciona sin timeout.
- Los fallos por fila se muestran con número de fila y motivo.
- El mapeo guardado se reutiliza si se sube un CSV con mismas columnas.
```

---

### Prompt 19 — "Modo Zen" (vista simplificada)

```
CONTEXTO:
App completa con todos los módulos. Feature de diferenciación enfocada en reducir ansiedad financiera.

OBJETIVO:
- Añade una ruta `/zen` accesible desde el menú de usuario y desde un botón en el dashboard.
- Muestra solo:
  - Saldo neto total (número grande).
  - Próximo movimiento (la transacción futura más cercana; requiere que `date` pueda ser futura — no cambia el backend, ya la soporta).
  - Un botón "Volver al dashboard".
- Diseño: centrado, fondo neutro, tipografía enorme, cero distracciones. No sidebar, no toolbar. Solo un logo pequeño y botón salir.
- Opcional (v2): un estado "modo enfoque" que oculte los montos hasta hacer tap (para evitar ansiedad).

RESTRICCIONES:
- Reutiliza endpoints existentes (`/analytics/overview` + `/transactions?from=today&sortBy=date&sortOrder=asc&limit=1`).
- Ruta protegida pero fuera del `MainLayoutComponent` (usa un `ZenLayoutComponent` propio).
- Sin gráficos, sin tablas, sin filtros.

CRITERIOS DE ACEPTACIÓN:
- El modo Zen se ve limpio, sin elementos de navegación.
- El saldo neto y el próximo movimiento son los únicos datos visibles.
- Cargar `/zen` directamente (URL) funciona sin pasar por el dashboard.
```

---

### Prompt 20 — Pulido transversal: estados vacíos, errores y loading

```
CONTEXTO:
Todos los features están implementados. Última pasada de UX para que la app "se sienta" terminada.

OBJETIVO:
Crea una pasada sistemática de pulido:

1. **Componentes shared** en `shared/components/`:
   - `EmptyStateComponent` (icono, título, mensaje, CTA opcional).
   - `LoadingSkeletonComponent` (variantes: card, list, chart).
   - `ErrorStateComponent` (retry callback).

2. **Manejador global de errores HTTP**:
   - Interceptor que capture errores 4xx/5xx y muestre `MatSnackBar` con mensaje legible.
   - Mapeo de códigos: 400 → "Revisa los datos", 401 → ya cubierto por Auth, 403 → "Sin permiso", 404 → "No encontrado", 500 → "Algo salió mal, reintenta".

3. **Auditoría de estados vacíos** por módulo:
   - Accounts: sin cuentas.
   - Transactions: sin transacciones vs sin resultados de filtro.
   - Categories: sin categorías / sin tags.
   - Budgets: sin presupuestos para el mes.
   - Dashboard: sin datos (onboarding).
   - Cada uno con mensaje específico + CTA contextual.

4. **Loading states consistentes**: skeleton en listas y cards; spinner solo en botones de acción; nunca pantalla en blanco.

5. **Accesibilidad mínima**: `aria-label` en botones icon-only, focus visible, contraste AA, navegación con teclado en diálogos (`mat-dialog` ya lo maneja).

RESTRICCIONES:
- Un componente `EmptyState` reutilizable, no dupliques markup.
- Los mensajes de error del backend (mensaje del `HttpException`) se respetan si son 400/409 (son útiles para el usuario).
- Sin lógica de negocio en estos componentes.

CRITERIOS DE ACEPTACIÓN:
- Ninguna vista muestra "pantalla vacía" sin explicación al usuario.
- Cualquier error 4xx/5xx produce un `MatSnackBar` con mensaje claro.
- Todos los formularios tienen feedback de loading en el submit.
- Lighthouse Accesibilidad ≥ 90.
```
