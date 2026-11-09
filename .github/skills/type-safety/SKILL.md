---
name: type-safety
description: >
  TypeScript estricto, class-validator en NestJS y reactive forms tipados en
  Angular para la app de finanzas personales. Úsalo al modificar contratos,
  DTOs, schemas Mongoose, formularios, señales o entradas externas.
---

# Tipado y validación

## Configuración del proyecto

Respeta el `tsconfig.base.json` y los `tsconfig.json` de cada workspace.
Backend (NestJS) y frontend (Angular) tienen `strict: true`. Angular además
usa `strictTemplates`, `strictInjectionParameters` y
`strictInputAccessModifiers`. No cambies la configuración global por una
tarea funcional.

Reglas que se asumen activas:

- `strict`, `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`
- `noUncheckedIndexedAccess` (backend) si está configurado
- `exactOptionalPropertyTypes` (backend) si está configurado
- `noImplicitOverride`, `noFallthroughCasesInSwitch` (backend)
- `strictTemplates` en Angular
- ESLint con `@typescript-eslint/no-explicit-any` como `error`

## Contratos: class-validator + Mongoose (backend)

- Los **DTOs** de entrada se validan con `class-validator` +
  `class-transformer` mediante `ValidationPipe` global:

  ```typescript
  // create-transaction.dto.ts
  import {
    IsEnum,
    IsISO8601,
    IsMongoId,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    MaxLength,
    Min,
  } from 'class-validator';
  import { TransactionType } from '../transaction.schema';

  export class CreateTransactionDto {
    @IsEnum(TransactionType)
    type: TransactionType;

    @IsNumber({ allowNaN: false, allowInfinity: false })
    @Min(0)
    amount: number; // centavos

    @IsISO8601()
    date: string;

    @IsString()
    @MaxLength(500)
    description: string;

    @IsMongoId()
    accountId: string;

    @IsOptional()
    @IsMongoId()
    categoryId?: string;

    @IsOptional()
    @IsMongoId()
    targetAccountId?: string;

    @IsOptional()
    @IsMongoId({ each: true })
    tagIds?: string[];
  }
  ```

- El schema Mongoose es la fuente de verdad del tipo persistido:

  ```typescript
  @Schema({ timestamps: true })
  export class Transaction {
    @Prop({ required: true, enum: Object.values(TransactionType) })
    type: TransactionType;

    @Prop({ required: true, min: 0, type: Number })
    amount: number;

    @Prop({ required: true, type: Date, index: true })
    date: Date;

    // ...
  }

  export const TransactionSchema = SchemaFactory.createForClass(Transaction);
  export type TransactionDocument = HydratedDocument<Transaction>;
  ```

- Los DTOs de respuesta se definen explícitamente o se derivan con
  `PickType`/`OmitType` de `@nestjs/mapped-types`. Nunca devuelvas el
  `HydratedDocument` crudo (contiene `_id`, `__v`); mapea a un DTO o a un
  objeto plano tipado.
- Las query params se validan con un DTO (`TransactionFilterDto`) y `@Query()`.
  Los `ParseUUIDPipe`/`ParseObjectIdPipe` custom viven en `common/pipes/`.

## Contratos: interfaces + typed forms (frontend)

Modelos TypeScript de entidad en `features/<feature>/models/`. Son interfaces
(no clases), puros datos:

```typescript
export interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number; // centavos
  date: string; // ISO 8601
  description: string;
  accountId: string;
  categoryId: string | null;
  targetAccountId: string | null;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}
```

Los reactive forms se tipan con `FormGroup<...>` y `NonNullableFormBuilder`:

```typescript
private readonly fb = inject(NonNullableFormBuilder);

readonly form = this.fb.group({
  type: this.fb.control<TransactionType>('expense'),
  amount: this.fb.control<number>(0, {
    validators: [Validators.required, Validators.min(0)],
  }),
  date: this.fb.control<Date>(new Date(), {
    validators: [Validators.required],
  }),
  description: this.fb.control<string>('', {
    validators: [Validators.required, Validators.maxLength(500)],
  }),
  accountId: this.fb.control<string>('', {
    validators: [Validators.required],
  }),
  categoryId: this.fb.control<string | null>(null),
});
```

- Los signals se tipan explícitamente cuando la inferencia no es obvia:
  `readonly accounts = signal<Account[]>([])`.
- Los stores exponen su estado como `Signal<T>` (readonly desde fuera) y
  métodos de mutación; no expongas el `WritableSignal` fuera del store.

## Reglas de tipado

- Evita `any`. Para valores desconocidos usa `unknown` y estrecha con guards
  o validación.
- Evita `Function`, `object` y `{}` si existe un tipo preciso.
- Usa uniones discriminadas para estados de UI:

  ```typescript
  type LoadState<T> =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; data: T }
    | { status: 'error'; message: string };
  ```

- Usa `satisfies` para comprobar estructuras conservando inferencia
  (configuraciones, mapas de rutas).
- Prefiere exhaustividad con `never` en switches de estados o tipos de
  transacción.
- Usa aserciones (`as`) solo en límites justificados (ej. respuesta de
  `HttpClient` mapeada a un modelo validado antes). No uses casts para
  silenciar incompatibilidades.
- No añadas `@ts-ignore` ni `@ts-expect-error` salvo que sea imprescindible,
  localizado y explicado en un comentario.
- Mantén imports ESM y extensiones coherentes con los archivos del workspace.

## Cambios de contratos

Al modificar un DTO, schema o modelo:

- Actualiza el DTO de entrada, el schema Mongoose y el modelo TypeScript del
  frontend en el mismo cambio.
- Actualiza tests del backend (DTO válido/inválido, service) y del frontend
  (componente con nuevo campo).
- Conserva códigos de error, IDs (string/ObjectId), timestamps ISO-8601 UTC y
  las invariantes del dominio (transferencias sin categoría, montos en
  centavos, etc.).
- No conviertas una entrada inválida en un valor por defecto silencioso: el
  `ValidationPipe` debe rechazar con 400.

## En el límite HTTP

- El frontend no confía en que el backend devuelva la forma correcta solo
  porque el modelo TS lo diga. El `ApiService` puede tipar la respuesta, pero
  los componentes deben manejar `null`/`undefined` en campos opcionales según
  el modelo.
- Los interceptores no inventan datos: si falta un campo, se trata como bug
  del backend y se registra (log), no se rellena con `''` o `0`.
