import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { Model, Types } from 'mongoose';
import { Account } from '../accounts/account.schema.js';
import { Category } from '../categories/category.schema.js';
import { Tag } from '../categories/tag.schema.js';
import { BulkCreateTransactionsResponseDto } from './dto/bulk-create-transactions-response.dto.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { TransactionQueryDto } from './dto/transaction-query.dto.js';
import {
  TransactionPageResponseDto,
  TransactionResponseDto,
} from './dto/transaction-response.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';
import {
  assertValidDateRange,
  assertValidTransactionState,
  buildTransactionFilter,
  type TransactionState,
} from './transaction-rules.js';
import { Transaction, TransactionDocument } from './transaction.schema.js';

const TRANSACTION_NOT_FOUND_MESSAGE = 'Transacción no encontrada';
const ACCOUNT_NOT_FOUND_MESSAGE = 'La cuenta no existe';
const CATEGORY_NOT_FOUND_MESSAGE = 'La categoría no existe';
const TAG_NOT_FOUND_MESSAGE = 'Alguna etiqueta no existe';
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_BULK_TRANSACTIONS = 200;
const BULK_NOT_ARRAY_MESSAGE = 'Se esperaba un array de transacciones';
const BULK_SIZE_MESSAGE = `Se pueden importar entre 1 y ${MAX_BULK_TRANSACTIONS} transacciones por petición`;
const ROW_NOT_OBJECT_MESSAGE = 'La fila no es un objeto válido';
const ROW_WRITE_FAILED_MESSAGE = 'No se pudo guardar la transacción';
const ROW_VALIDATION_FAILED_MESSAGE = 'Los datos no cumplen el esquema de transacciones';

function toNullableId(value: Types.ObjectId | null): string | null {
  return value ? value.toString() : null;
}

function toTransactionResponse(
  transaction: TransactionDocument,
): TransactionResponseDto {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    date: transaction.date,
    description: transaction.description,
    accountId: transaction.accountId.toString(),
    targetAccountId: toNullableId(transaction.targetAccountId),
    categoryId: toNullableId(transaction.categoryId),
    tagIds: transaction.tagIds.map((tagId) => tagId.toString()),
    notes: transaction.notes ?? null,
    createdAt: transaction.createdAt ?? new Date(0),
    updatedAt: transaction.updatedAt ?? new Date(0),
  };
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function uniqueIds(ids: Array<string | null>): string[] {
  return [...new Set(ids.filter((id): id is string => id !== null))];
}

interface ParsedRow {
  index: number;
  dto: CreateTransactionDto;
}

type RowParseResult = { dto: CreateTransactionDto } | { message: string };

interface OwnedReferences {
  accounts: Set<string>;
  categories: Set<string>;
  tags: Set<string>;
}

interface BulkFailure {
  index: number;
  message: string;
}

// Normaliza a minúsculas: los ObjectId llegan en hex, y Mongo los devuelve en minúsculas.
function idKey(id: string): string {
  return id.toLowerCase();
}

async function parseTransactionRow(row: unknown): Promise<RowParseResult> {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) {
    return { message: ROW_NOT_OBJECT_MESSAGE };
  }

  const dto = plainToInstance(CreateTransactionDto, row);
  const violations = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (violations.length > 0) {
    return { message: describeViolations(violations) };
  }

  try {
    assertValidTransactionState({
      type: dto.type,
      accountId: dto.accountId,
      targetAccountId: dto.targetAccountId ?? null,
      categoryId: dto.categoryId ?? null,
      tagIds: dto.tagIds ?? [],
    });
  } catch (error) {
    if (error instanceof BadRequestException) {
      return { message: error.message };
    }
    throw error;
  }

  return { dto };
}

function describeViolations(violations: ValidationError[]): string {
  return `Campos no válidos: ${violations.map((violation) => violation.property).join(', ')}`;
}

async function findOwnedIds<T>(
  model: Model<T>,
  userId: string,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set();
  }
  const docs = await model
    .find({ _id: { $in: ids }, userId }, { _id: 1 })
    .lean<Array<{ _id: Types.ObjectId }>>()
    .exec();
  return new Set(docs.map((doc) => idKey(doc._id.toString())));
}

function findUnownedReferenceMessage(
  dto: CreateTransactionDto,
  owned: OwnedReferences,
): string | null {
  if (!owned.accounts.has(idKey(dto.accountId))) {
    return ACCOUNT_NOT_FOUND_MESSAGE;
  }
  if (dto.targetAccountId && !owned.accounts.has(idKey(dto.targetAccountId))) {
    return ACCOUNT_NOT_FOUND_MESSAGE;
  }
  if (dto.categoryId && !owned.categories.has(idKey(dto.categoryId))) {
    return CATEGORY_NOT_FOUND_MESSAGE;
  }
  if ((dto.tagIds ?? []).some((tagId) => !owned.tags.has(idKey(tagId)))) {
    return TAG_NOT_FOUND_MESSAGE;
  }
  return null;
}

// Extrae los fallos por documento de un insertMany no ordenado; relanza cualquier otro error.
function readBulkFailures(error: unknown): BulkFailure[] {
  const bulk = error as {
    writeErrors?: Array<{ index: number }>;
    validationErrors?: Array<{ index?: number }>;
  } | null;
  if (!bulk || (!bulk.writeErrors && !bulk.validationErrors)) {
    throw error;
  }

  const writeFailures = (bulk.writeErrors ?? []).map((writeError) => ({
    index: writeError.index,
    message: ROW_WRITE_FAILED_MESSAGE,
  }));
  const validationFailures = (bulk.validationErrors ?? []).flatMap((validationError) =>
    validationError.index === undefined
      ? []
      : [{ index: validationError.index, message: ROW_VALIDATION_FAILED_MESSAGE }],
  );
  return [...writeFailures, ...validationFailures];
}


@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    @InjectModel(Account.name)
    private readonly accountModel: Model<Account>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,
    @InjectModel(Tag.name) private readonly tagModel: Model<Tag>,
  ) {}

  async findPageByUser(
    userId: string,
    query: TransactionQueryDto,
  ): Promise<TransactionPageResponseDto> {
    assertValidDateRange(query.from, query.to);

    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const direction = query.sortOrder === 'asc' ? 1 : -1;
    const sortField = query.sortBy ?? 'date';
    const filter = buildTransactionFilter(userId, query);

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .sort({ [sortField]: direction, _id: direction })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.transactionModel.countDocuments(filter).exec(),
    ]);

    return {
      data: transactions.map(toTransactionResponse),
      total,
      page,
      pageSize,
    };
  }

  async findOneByUser(
    userId: string,
    id: string,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.findOwnedDocument(userId, id);
    return toTransactionResponse(transaction);
  }

  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const state: TransactionState = {
      type: dto.type,
      accountId: dto.accountId,
      targetAccountId: dto.targetAccountId ?? null,
      categoryId: dto.categoryId ?? null,
      tagIds: dto.tagIds ?? [],
    };
    assertValidTransactionState(state);
    await this.assertReferencesOwned(userId, state);

    const transaction = await this.transactionModel.create({
      ...dto,
      userId,
      targetAccountId: state.targetAccountId,
      categoryId: state.categoryId,
      tagIds: state.tagIds,
    });
    return toTransactionResponse(transaction);
  }

  // Cada fila se valida y comprueba por separado: una fila inválida no impide insertar el resto.
  async createMany(
    userId: string,
    rows: unknown,
  ): Promise<BulkCreateTransactionsResponseDto> {
    if (!Array.isArray(rows)) {
      throw new BadRequestException(BULK_NOT_ARRAY_MESSAGE);
    }
    if (rows.length === 0 || rows.length > MAX_BULK_TRANSACTIONS) {
      throw new BadRequestException(BULK_SIZE_MESSAGE);
    }

    const failures = new Map<number, string>();
    const candidates: ParsedRow[] = [];
    const parsed = await Promise.all(
      rows.map((row) => parseTransactionRow(row)),
    );
    parsed.forEach((result, index) => {
      if ('dto' in result) {
        candidates.push({ index, dto: result.dto });
      } else {
        failures.set(index, result.message);
      }
    });

    const owned = await this.findOwnedReferences(
      userId,
      candidates.map((candidate) => candidate.dto),
    );
    const accepted: ParsedRow[] = [];
    for (const candidate of candidates) {
      const message = findUnownedReferenceMessage(candidate.dto, owned);
      if (message) {
        failures.set(candidate.index, message);
      } else {
        accepted.push(candidate);
      }
    }

    for (const [index, message] of await this.insertAccepted(userId, accepted)) {
      failures.set(index, message);
    }

    const errors = [...failures.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, message]) => ({ index, message }));
    return {
      inserted: rows.length - errors.length,
      failed: errors.length,
      errors,
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const existing = await this.findOwnedDocument(userId, id);

    // Se valida el estado resultante, no solo los campos enviados.
    const state: TransactionState = {
      type: dto.type ?? existing.type,
      accountId: dto.accountId ?? existing.accountId.toString(),
      targetAccountId:
        dto.targetAccountId !== undefined
          ? dto.targetAccountId
          : toNullableId(existing.targetAccountId),
      categoryId:
        dto.categoryId !== undefined
          ? dto.categoryId
          : toNullableId(existing.categoryId),
      tagIds: dto.tagIds ?? existing.tagIds.map((tagId) => tagId.toString()),
    };
    assertValidTransactionState(state);
    await this.assertReferencesOwned(userId, state);

    const changes = withoutUndefined(dto);
    const transaction = await this.transactionModel
      .findOneAndUpdate(
        { _id: id, userId },
        { $set: changes },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
    if (!transaction) {
      throw new NotFoundException(TRANSACTION_NOT_FOUND_MESSAGE);
    }
    return toTransactionResponse(transaction);
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.transactionModel
      .deleteOne({ _id: id, userId })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(TRANSACTION_NOT_FOUND_MESSAGE);
    }
  }

  // Devuelve los fallos por índice original (posición en el array de entrada).
  private async insertAccepted(
    userId: string,
    rows: ParsedRow[],
  ): Promise<Map<number, string>> {
    const failures = new Map<number, string>();
    if (rows.length === 0) {
      return failures;
    }

    const docs = rows.map(({ dto }) => ({
      ...dto,
      userId,
      targetAccountId: dto.targetAccountId ?? null,
      categoryId: dto.categoryId ?? null,
      tagIds: dto.tagIds ?? [],
    }));

    try {
      await this.transactionModel.insertMany(docs, {
        ordered: false,
        throwOnValidationError: true,
      });
    } catch (error) {
      for (const failure of readBulkFailures(error)) {
        const row = rows[failure.index];
        if (row) {
          failures.set(row.index, failure.message);
        }
      }
    }
    return failures;
  }

  private async findOwnedReferences(
    userId: string,
    dtos: CreateTransactionDto[],
  ): Promise<OwnedReferences> {
    const [accounts, categories, tags] = await Promise.all([
      findOwnedIds(
        this.accountModel,
        userId,
        uniqueIds(dtos.flatMap((dto) => [dto.accountId, dto.targetAccountId ?? null])),
      ),
      findOwnedIds(
        this.categoryModel,
        userId,
        uniqueIds(dtos.map((dto) => dto.categoryId ?? null)),
      ),
      findOwnedIds(
        this.tagModel,
        userId,
        uniqueIds(dtos.flatMap((dto) => dto.tagIds ?? [])),
      ),
    ]);
    return { accounts, categories, tags };
  }

  private async findOwnedDocument(
    userId: string,
    id: string,
  ): Promise<TransactionDocument> {
    const transaction = await this.transactionModel
      .findOne({ _id: id, userId })
      .exec();
    if (!transaction) {
      throw new NotFoundException(TRANSACTION_NOT_FOUND_MESSAGE);
    }
    return transaction;
  }

  // Impide referenciar cuentas, categorías o etiquetas de otro usuario.
  private async assertReferencesOwned(
    userId: string,
    state: TransactionState,
  ): Promise<void> {
    await Promise.all([
      this.assertAllOwned(
        uniqueIds([state.accountId, state.targetAccountId]),
        ACCOUNT_NOT_FOUND_MESSAGE,
        (ids) =>
          this.accountModel
            .countDocuments({ _id: { $in: ids }, userId })
            .exec(),
      ),
      this.assertAllOwned(
        uniqueIds([state.categoryId]),
        CATEGORY_NOT_FOUND_MESSAGE,
        (ids) =>
          this.categoryModel
            .countDocuments({ _id: { $in: ids }, userId })
            .exec(),
      ),
      this.assertAllOwned(
        uniqueIds(state.tagIds),
        TAG_NOT_FOUND_MESSAGE,
        (ids) =>
          this.tagModel.countDocuments({ _id: { $in: ids }, userId }).exec(),
      ),
    ]);
  }

  private async assertAllOwned(
    ids: string[],
    message: string,
    countOwned: (ids: string[]) => Promise<number>,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const count = await countOwned(ids);
    if (count !== ids.length) {
      throw new BadRequestException(message);
    }
  }
}
