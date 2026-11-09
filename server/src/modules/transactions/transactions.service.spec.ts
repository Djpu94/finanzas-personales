import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Account } from '../accounts/account.schema.js';
import type { Category } from '../categories/category.schema.js';
import type { Tag } from '../categories/tag.schema.js';
import type { Transaction } from './transaction.schema.js';
import { TransactionsService } from './transactions.service.js';

type ModelMock = {
  create: Mock;
  find: Mock;
  findOne: Mock;
  findOneAndUpdate: Mock;
  countDocuments: Mock;
  deleteOne: Mock;
};

function execQuery(result: unknown) {
  return { exec: vi.fn().mockResolvedValue(result) };
}

function createModelMock(): ModelMock {
  return {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    countDocuments: vi.fn().mockReturnValue(execQuery(1)),
    deleteOne: vi.fn(),
  };
}

describe('TransactionsService', () => {
  const userId = '665f1a2b3c4d5e6f7a8b9c0d';
  const transactionId = '665f1a2b3c4d5e6f7a8b9c10';
  const accountA = '665f1a2b3c4d5e6f7a8b9c01';
  const accountB = '665f1a2b3c4d5e6f7a8b9c02';
  const categoryId = '665f1a2b3c4d5e6f7a8b9c03';
  const tagId = '665f1a2b3c4d5e6f7a8b9c04';

  const transactionDocument = {
    id: transactionId,
    type: 'expense',
    amount: 1250,
    date: new Date('2024-01-15T00:00:00Z'),
    description: 'Supermercado',
    accountId: { toString: () => accountA },
    targetAccountId: null,
    categoryId: { toString: () => categoryId },
    tagIds: [{ toString: () => tagId }],
    notes: undefined,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  };

  let transactionModel: ModelMock;
  let accountModel: ModelMock;
  let categoryModel: ModelMock;
  let tagModel: ModelMock;
  let service: TransactionsService;

  beforeEach(() => {
    transactionModel = createModelMock();
    accountModel = createModelMock();
    categoryModel = createModelMock();
    tagModel = createModelMock();
    service = new TransactionsService(
      transactionModel as unknown as Model<Transaction>,
      accountModel as unknown as Model<Account>,
      categoryModel as unknown as Model<Category>,
      tagModel as unknown as Model<Tag>,
    );
  });

  describe('create', () => {
    it('crea un gasto con categoría y etiquetas del usuario', async () => {
      transactionModel.create.mockResolvedValue(transactionDocument);

      const result = await service.create(userId, {
        type: 'expense',
        amount: 1250,
        date: new Date('2024-01-15T00:00:00Z'),
        description: 'Supermercado',
        accountId: accountA,
        categoryId,
        tagIds: [tagId],
      });

      expect(accountModel.countDocuments).toHaveBeenCalledWith({
        _id: { $in: [accountA] },
        userId,
      });
      expect(transactionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: 'expense',
          accountId: accountA,
          targetAccountId: null,
          categoryId,
          tagIds: [tagId],
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          id: transactionId,
          accountId: accountA,
          categoryId,
          tagIds: [tagId],
          targetAccountId: null,
          notes: null,
        }),
      );
    });

    it('crea un ingreso sin categoría', async () => {
      transactionModel.create.mockResolvedValue({
        ...transactionDocument,
        type: 'income',
        categoryId: null,
      });

      const result = await service.create(userId, {
        type: 'income',
        amount: 300000,
        date: new Date('2024-01-01T00:00:00Z'),
        description: 'Nómina',
        accountId: accountA,
      });

      expect(transactionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'income',
          categoryId: null,
          tagIds: [],
        }),
      );
      expect(result.categoryId).toBeNull();
      expect(categoryModel.countDocuments).not.toHaveBeenCalled();
    });

    it('crea una transferencia como un único documento con origen y destino', async () => {
      accountModel.countDocuments.mockReturnValue(execQuery(2));
      transactionModel.create.mockResolvedValue({
        ...transactionDocument,
        type: 'transfer',
        categoryId: null,
        targetAccountId: { toString: () => accountB },
      });

      const result = await service.create(userId, {
        type: 'transfer',
        amount: 5000,
        date: new Date('2024-01-20T00:00:00Z'),
        description: 'Ahorro mensual',
        accountId: accountA,
        targetAccountId: accountB,
      });

      expect(transactionModel.create).toHaveBeenCalledTimes(1);
      expect(transactionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'transfer',
          accountId: accountA,
          targetAccountId: accountB,
          categoryId: null,
        }),
      );
      expect(accountModel.countDocuments).toHaveBeenCalledWith({
        _id: { $in: [accountA, accountB] },
        userId,
      });
      expect(result.targetAccountId).toBe(accountB);
    });

    it('rechaza una transferencia a la misma cuenta con 400 y no persiste', async () => {
      await expect(
        service.create(userId, {
          type: 'transfer',
          amount: 5000,
          date: new Date('2024-01-20T00:00:00Z'),
          description: 'Mismo sitio',
          accountId: accountA,
          targetAccountId: accountA,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionModel.create).not.toHaveBeenCalled();
    });

    it('rechaza una transferencia con categoría', async () => {
      await expect(
        service.create(userId, {
          type: 'transfer',
          amount: 5000,
          date: new Date('2024-01-20T00:00:00Z'),
          description: 'Con categoría',
          accountId: accountA,
          targetAccountId: accountB,
          categoryId,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionModel.create).not.toHaveBeenCalled();
    });

    it('rechaza referencias a cuentas que no pertenecen al usuario', async () => {
      accountModel.countDocuments.mockReturnValue(execQuery(0));

      await expect(
        service.create(userId, {
          type: 'expense',
          amount: 100,
          date: new Date('2024-01-15T00:00:00Z'),
          description: 'Ajena',
          accountId: accountA,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionModel.create).not.toHaveBeenCalled();
    });

    it('rechaza etiquetas que no pertenecen al usuario', async () => {
      tagModel.countDocuments.mockReturnValue(execQuery(0));

      await expect(
        service.create(userId, {
          type: 'expense',
          amount: 100,
          date: new Date('2024-01-15T00:00:00Z'),
          description: 'Etiqueta ajena',
          accountId: accountA,
          tagIds: [tagId],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findPageByUser', () => {
    function mockFind(result: unknown[], total: number) {
      const limit = vi.fn().mockReturnValue(execQuery(result));
      const skip = vi.fn().mockReturnValue({ limit });
      const sort = vi.fn().mockReturnValue({ skip });
      transactionModel.find.mockReturnValue({ sort });
      transactionModel.countDocuments.mockReturnValue(execQuery(total));
      return { sort, skip, limit };
    }

    it('aplica filtros de fecha, cuenta y tipo y devuelve la página', async () => {
      const { sort, skip, limit } = mockFind([transactionDocument], 1);

      const result = await service.findPageByUser(userId, {
        from: new Date('2024-01-01T00:00:00Z'),
        to: new Date('2024-01-31T00:00:00Z'),
        accountId: accountA,
        type: 'expense',
      });

      const expectedFilter = {
        userId,
        date: {
          $gte: new Date('2024-01-01T00:00:00Z'),
          $lte: new Date('2024-01-31T00:00:00Z'),
        },
        $or: [{ accountId: accountA }, { targetAccountId: accountA }],
        type: 'expense',
      };
      expect(transactionModel.find).toHaveBeenCalledWith(expectedFilter);
      expect(transactionModel.countDocuments).toHaveBeenCalledWith(
        expectedFilter,
      );
      expect(sort).toHaveBeenCalledWith({ date: -1, _id: -1 });
      expect(skip).toHaveBeenCalledWith(0);
      expect(limit).toHaveBeenCalledWith(20);
      expect(result).toEqual({
        data: [expect.objectContaining({ id: transactionId })],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    });

    it('calcula el salto de página con page y pageSize', async () => {
      const { skip, limit } = mockFind([], 45);

      const result = await service.findPageByUser(userId, {
        page: 3,
        pageSize: 10,
      });

      expect(skip).toHaveBeenCalledWith(20);
      expect(limit).toHaveBeenCalledWith(10);
      expect(result).toEqual({ data: [], total: 45, page: 3, pageSize: 10 });
    });

    it('ordena por el campo y sentido indicados', async () => {
      const { sort } = mockFind([], 0);

      await service.findPageByUser(userId, {
        sortBy: 'amount',
        sortOrder: 'asc',
      });

      expect(sort).toHaveBeenCalledWith({ amount: 1, _id: 1 });
    });

    it('busca por descripción sin distinguir mayúsculas', async () => {
      mockFind([], 0);

      await service.findPageByUser(userId, { search: 'super' });

      expect(transactionModel.find).toHaveBeenCalledWith({
        userId,
        description: { $regex: 'super', $options: 'i' },
      });
    });

    it('rechaza un rango de fechas invertido', async () => {
      await expect(
        service.findPageByUser(userId, {
          from: new Date('2024-02-01T00:00:00Z'),
          to: new Date('2024-01-01T00:00:00Z'),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionModel.find).not.toHaveBeenCalled();
    });
  });

  describe('findOneByUser', () => {
    it('busca por id y userId a la vez', async () => {
      transactionModel.findOne.mockReturnValue(execQuery(transactionDocument));

      const result = await service.findOneByUser(userId, transactionId);

      expect(transactionModel.findOne).toHaveBeenCalledWith({
        _id: transactionId,
        userId,
      });
      expect(result.id).toBe(transactionId);
    });

    it('lanza NotFoundException si pertenece a otro usuario', async () => {
      transactionModel.findOne.mockReturnValue(execQuery(null));

      await expect(
        service.findOneByUser(userId, transactionId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('valida el estado resultante: cambiar a transferencia sin destino falla', async () => {
      transactionModel.findOne.mockReturnValue(execQuery(transactionDocument));

      await expect(
        service.update(userId, transactionId, { type: 'transfer' }),
      ).rejects.toThrow(BadRequestException);
      expect(transactionModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rechaza convertir en transferencia a la misma cuenta', async () => {
      transactionModel.findOne.mockReturnValue(execQuery(transactionDocument));

      await expect(
        service.update(userId, transactionId, {
          type: 'transfer',
          targetAccountId: accountA,
          categoryId: null,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('actualiza solo los campos enviados', async () => {
      transactionModel.findOne.mockReturnValue(execQuery(transactionDocument));
      transactionModel.findOneAndUpdate.mockReturnValue(
        execQuery({ ...transactionDocument, amount: 2000 }),
      );

      const result = await service.update(userId, transactionId, {
        amount: 2000,
      });

      expect(transactionModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: transactionId, userId },
        { $set: { amount: 2000 } },
        { returnDocument: 'after', runValidators: true },
      );
      expect(result.amount).toBe(2000);
    });
  });

  describe('remove', () => {
    it('elimina la transacción del usuario', async () => {
      transactionModel.deleteOne.mockReturnValue(
        execQuery({ deletedCount: 1 }),
      );

      await service.remove(userId, transactionId);

      expect(transactionModel.deleteOne).toHaveBeenCalledWith({
        _id: transactionId,
        userId,
      });
    });

    it('lanza NotFoundException si no existe o es de otro usuario', async () => {
      transactionModel.deleteOne.mockReturnValue(
        execQuery({ deletedCount: 0 }),
      );

      await expect(service.remove(userId, transactionId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
