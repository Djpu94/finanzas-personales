import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Account } from '../accounts/account.schema.js';
import { Category } from '../categories/category.schema.js';
import { Tag } from '../categories/tag.schema.js';
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
