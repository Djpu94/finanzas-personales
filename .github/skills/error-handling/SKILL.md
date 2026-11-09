---
name: error-handling
description: >
  Manejo de errores en la app de finanzas personales con HttpException de
  NestJS y el interceptor de Angular. Úsalo al cambiar dominio, services,
  controllers, guards, interceptores o componentes que consuman HTTP.
---

# Manejo de errores

## Contratos que existen

- **Backend**: `HttpException` y subclases nativas de NestJS
  (`BadRequestException`, `UnauthorizedException`, `ForbiddenException`,
  `NotFoundException`, `ConflictException`,
  `InternalServerErrorException`). No inventes un `Result<T, E>` propio para
  HTTP; usa el patrón nativo.
- **Formato de error** (default Nest): `{ statusCode, message, error }`.
  Mantén este formato; no lo sustituyas por `{ ok: false, code }`.
- **Frontend**: `HttpErrorResponse` de `@angular/common/http`. Un
  `ErrorInterceptor` global captura los 4xx/5xx y muestra `MatSnackBar`
  cuando aplica. Los componentes pueden manejar casos específicos si lo
  necesitan.
- **Códigos estables** para errores de negocio recurrentes viven como
  constantes en `common/errors/` (backend) si el frontend debe distinguirlos.
  Por defecto, el `statusCode` HTTP es suficiente.

## Clasifica antes de manejar

- **Errores esperados de validación**: `ValidationPipe` global lanza
  `BadRequestException` (400). No añadas try/catch; deja que el pipe global
  haga su trabajo.
- **Errores de autenticación/autorización**: `JwtAuthGuard` lanza 401; la
  lógica de propiedad (account no pertenece al user) lanza 403 vía
  `ForbiddenException`. Nunca 404 por seguridad (evita filtrar existencia).
- **Errores de recurso no encontrado** (ID válido pero no existe o no
  pertenece al user): `NotFoundException`. Para recursos del usuario, filtra
  siempre por `userId` en la query y devuelve 404 si no aparece; no expongas
  si existe en otra cuenta.
- **Conflictos** (nombre duplicado, budget ya existe para ese periodo):
  `ConflictException` (409) con mensaje accionable.
- **Errores inesperados** (bugs, DB caída, timeout): **regístralos** con
  `Logger.error` en el punto donde se traducen a 500 (`AllExceptionsFilter`
  global en `core/filters/`) y devuelve un mensaje genérico. Nunca expongas el
  error original al cliente.
- **Errores de Mongoose**:
  - `E11000` (unique index) → `ConflictException`.
  - `CastError` (ObjectId inválido) → `BadRequestException`.
  - `ValidationError` → `BadRequestException` con detalles de los campos
    fallidos (sin stack).

## Reglas

- No uses `catch` genéricos que silencien fallos, devuelvan `undefined` o
  datos ficticios. Un `catch` solo existe si puedes recuperarte, añadir
  contexto, registrar el fallo o traducirlo a un contrato seguro.
- Conserva el error original cuando lo envuelvas
  (`throw new InternalServerErrorException(...)` con `{ cause: error }` si se
  soporta) para mantener el stack en logs.
- Distingue `null` permitido en una respuesta (ej. `categoryId: null` en una
  transacción) de un fallo de aplicación. El primero es un dato válido; el
  segundo es una excepción.
- Mantén mensajes útiles para la persona usuaria y códigos estables para que
  el frontend pueda decidir cómo actuar.
- No expongas rutas locales, tokens, contenido de transacciones ni trazas al
  frontend.

## Frontend (Angular)

- **`ErrorInterceptor`** (`core/interceptors/error.interceptor.ts`):
  - Captura `HttpErrorResponse`.
  - Mapea códigos a mensajes legibles:
    - 400 → "Revisa los datos del formulario"
    - 401 → delega en `AuthService` (refresh/logout)
    - 403 → "Sin permiso para esta acción"
    - 404 → "Recurso no encontrado"
    - 409 → usa el `message` del backend (es útil y accionable)
    - 5xx → "Algo salió mal. Inténtalo de nuevo." + botón "Reintentar"
      en el snackbar si el contexto lo permite.
  - Usa `MatSnackBar` con `duration` adecuado (4-6s para errores; sin
    `duration` para errores 5xx que requieren acción).
- **En componentes**: maneja el `error` del observable en el submit del
  formulario. **No pierdas el borrador**. Deshabilita el botón durante el
  submit; rehabilítalo al terminar (éxito o error).
- **En stores (Signals)**: el estado `error` se expone como Signal para que
  el componente muestre `ErrorStateComponent` inline cuando corresponda
  (ej. fallo al cargar la lista).
- **En `AuthService`**: si el refresh falla, limpia el estado y redirige a
  `/login`. No dejes un estado intermedio en el que el usuario "parece
  logueado" pero el backend lo rechaza.
- **En `ApiService`**: normaliza la respuesta. Los servicios de feature
  reciben el modelo ya tipado o lanzan el error hacia arriba.

## Errores de red y timeouts

- Configura `timeout` en las peticiones HTTP (default 30s) y maneja el
  `TimeoutError` como 5xx.
- Si el backend tarda en analytics (aggregation pesada), considera un estado
  de "cargando" con `LoadingSkeleton` antes de mostrar el error; un error
  prematuro por timeout (ej. 5s) frustra al usuario.
- En el service worker (PWA), si una petición falla offline, muestra el
  banner "Datos sin conexión" en lugar de un error genérico.

## Antes de cambiar un contrato de error

Revisa:

- `server/src/core/filters/all-exceptions.filter.ts` (formato de error).
- `server/src/core/guards/jwt-auth.guard.ts` (401 vs 403).
- `client/src/app/core/interceptors/error.interceptor.ts` (mapeo de códigos).
- Tests existentes de services que verifiquen códigos HTTP.

Mantén ambos lados coherentes: cambiar el backend sin actualizar el
interceptor rompe la UX de errores.
