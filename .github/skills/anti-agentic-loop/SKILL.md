---
name: anti-agentic-loop
description: >
  Evita ciclos improductivos al implementar, depurar y validar la app de
  finanzas personales. Úsalo cuando una tarea necesite más de una edición o
  ejecución de pruebas.
---

# Prevención de ciclos improductivos

## Define el resultado verificable

Antes de editar, expresa los criterios de aceptación en términos observables:
contrato esperado (endpoint, DTO, schema), test afectado, comando de
validación y, para UI, estado o flujo visible. Escoge el comando más pequeño
que cubra el cambio.

Comandos de referencia (npm workspaces):

- `npm run typecheck -w server` / `npm run typecheck -w client`
- `npm run test -w server -- src/modules/transactions/transactions.service.spec.ts`
- `npm run test -w client -- features/transactions/transactions-list.component.spec.ts`
- `npm run test:integration -w server -- path/to/file.integration-spec.ts`
- `npm run lint`
- `npm run test:e2e -- client/e2e/login.spec.ts`

Comprueba la sintaxis de los argumentos con el script real antes de depender
de un selector. Usa los scripts del workspace cuando cubran mejor el caso.

## Itera con evidencia

1. Reproduce el fallo o confirma el comportamiento actual.
2. Formula una hipótesis concreta ligada a una causa del código (no "quizás
   sea el pipe").
3. Haz el cambio más acotado que pueda resolverla.
4. Ejecuta el check y revisa el resultado completo.
5. Si falla, cambia la hipótesis solo cuando haya evidencia nueva.

Limita a **tres ciclos** de edición y comprobación para el mismo problema.
Este límite no justifica entregar una solución incompleta: al alcanzarlo,
detente, informa qué se verificó y pide orientación o recomienda el siguiente
diagnóstico.

## Detente antes si

- El mismo check da el mismo fallo dos veces consecutivas.
- El resultado no cambia entre intentos y no aparece evidencia nueva.
- El arreglo empieza a cambiar paquetes, contratos o módulos fuera del
  alcance (ej. tocar Auth para arreglar Transactions).
- Una corrección causa una regresión en un check que ya pasaba.
- Faltan datos o una decisión de producto que no se pueda inferir con
  seguridad (ej. ¿transferencias cuentan en el presupuesto?).

## No uses como atajos

- No desactives tests, ESLint ni TypeScript para lograr un resultado verde.
- No introduzcas `any`, `@ts-ignore`, `eslint-disable`,
  `ValidationPipe` con `whitelist: false` para evitar comprender el error.
- No repitas comandos amplios (`npm run test` completo) si un check enfocado
  identifica el problema.
- No amplíes el alcance para arreglar fallos preexistentes no relacionados
  (ej. "de paso arreglo este test de budgets").
- No cambies la configuración global del proyecto (`tsconfig`,
  `jest.config`, `angular.json`) para hacer pasar un test.

## Comunica un bloqueo con precisión

Incluye el criterio pendiente, los pasos intentados, el resultado y el
mensaje exacto del último fallo. Separa hechos de hipótesis y no afirmes que
la tarea está terminada si el criterio no se verificó.
