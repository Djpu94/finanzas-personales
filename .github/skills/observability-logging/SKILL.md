---
name: observability-logging
description: >
  Logging estructurado y diagnóstico seguro en NestJS, MongoDB y Angular para
  la app de finanzas personales. Úsalo al añadir errores, guards, filtros,
  interceptores, servicios de analytics o estados de UI.
---

# Observabilidad y logging

## Sigue el logger nativo de NestJS

- En el backend, usa `Logger` de `@nestjs/common` con `context`
  (`new Logger('TransactionsService')`). No añadas `winston`, `pino` ni
  `bunyan` para un caso aislado; si el proyecto migra a un logger
  estructurado, hazlo de forma global y documentada.
- En el arranque de `main.ts`, `NestFactory.create(AppModule, { logger: [...] })`
  define los niveles activos. No cambies la configuración por una tarea
  funcional.
- En Angular, la observabilidad del usuario es **UI** (`MatSnackBar`,
  `ErrorStateComponent`), no `console.log`. El `console.log` en producción
  está prohibido por lint configurado en el proyecto.
- En HTTP entrante, NestJS gestiona el logging de peticiones si se habilita.
  No dupliques logs "request received / request finished" en cada controller.

## Qué registrar

Usa campos estables, un mensaje/evento conciso y un **contexto de correlación**
cuando exista (`userId`, `requestId`, `transactionId`).

```typescript
this.logger.error(
  {
    event: 'transactions.create_failed',
    userId,
    accountId: dto.accountId,
    errorName: error instanceof Error ? error.name : 'UnknownError',
  },
  'Error creando transacción',
);
```

- Errores inesperados: regístralos en el límite donde se traducen a
  `HttpException`. No dupliques el mismo error en controller + service +
  repository; solo en el punto de traducción.
- Errores esperados (validación, 404, 409): no los registres como error. Como
  mucho `warn` con el código y el `userId`.
- Operaciones de negocio completadas: `debug` o `verbose`, nunca `log`. El
  log está reservado para eventos operativos (arranque, conexión a MongoDB,
  migraciones aplicadas).
- Analytics/aggregations: registra en `debug` la duración de los pipelines
  costosos (con `Date.now()` alrededor) para diagnosticar rendimiento.

## Privacidad y datos financieros

- Nunca registres montos individuales con `userId` asociado, hashes de
  passwords, tokens JWT, cookies, contenidos de DTOs completos, datos
  personales, nombres de cuentas, descripciones de transacciones ni notas.
- Los logs de error pueden incluir `userId` (identificador opaco) pero no el
  email ni el nombre.
- No serialices objetos `Request`, `Response`, `HttpException` completos.
  Extrae los campos necesarios (`status`, `code`, `errorName`).
- Las respuestas al frontend no incluyen stacks, rutas de archivo ni detalles
  internos. Solo `{ statusCode, message, error }` con mensajes seguros.

## MongoDB y rendimiento

- Activa el profiling de queries lentas en desarrollo
  (`mongoose.set('debug', ...)` condicionado a `NODE_ENV=development`). No en
  producción.
- Registra en `debug` el plan de ejecución de los pipelines de analytics
  cuando superen un umbral (ej. >500ms) para detectar índices faltantes.
- Los errores de validación de Mongoose (Unique index, CastError) se traducen
  a `HttpException` con código estable (`CONFLICT`, `BAD_REQUEST`) antes de
  llegar al logger de error inesperado.

## Correlation ID (opcional pero recomendado)

- Añade un middleware global en `core/` que genere un `requestId` (uuid v4)
  por petición y lo adjunte a `req` + `res.locals`.
- Los logs de servicio pueden incluirlo como campo `requestId`.
- No lo devuelvas en headers de respuesta salvo que un cliente lo consuma
  explícitamente.

## Verificación

- `npm run lint -w server` detecta usos de `console.log` si la regla está
  activa.
- En un entorno de desarrollo, un fallo de creación de transacción debe
  generar exactamente un log de error (en el controller/filter), no tres.
- El log no incluye `password`, `amount` ni `description` del payload.
