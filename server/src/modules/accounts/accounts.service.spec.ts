import { NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Account } from './account.schema.js';
import { AccountsService } from './accounts.service.js';

type AccountModelMock = {
  create: Mock;
  find: Mock;
  findOne: Mock;
  findOneAndUpdate: Mock;
  updateOne: Mock;
};

function execQuery(result: unknown) {
  return { exec: vi.fn().mockResolvedValue(result) };
}

describe('AccountsService', () => {
  const userId = '665f1a2b3c4d5e6f7a8b9c0d';
  const otherUserId = '665f1a2b3c4d5e6f7a8b9c0e';
  const accountId = '665f1a2b3c4d5e6f7a8b9c11';

  const accountDocument = {
    id: accountId,
    name: 'Cuenta nómina',
    type: 'checking',
    initialBalance: 150000,
    currency: 'EUR',
    isArchived: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  let accountModel: AccountModelMock;
  let service: AccountsService;

  beforeEach(() => {
    accountModel = {
      create: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      updateOne: vi.fn(),
    };
    service = new AccountsService(accountModel as unknown as Model<Account>);
  });

  describe('findAllByUser', () => {
    it('filtra por userId y excluye archivadas por defecto', async () => {
      const sort = vi.fn().mockReturnValue(execQuery([accountDocument]));
      accountModel.find.mockReturnValue({ sort });

      const result = await service.findAllByUser(userId);

      expect(accountModel.find).toHaveBeenCalledWith({
        userId,
        isArchived: false,
      });
      expect(result).toEqual([
        expect.objectContaining({ id: accountId, name: 'Cuenta nómina' }),
      ]);
    });

    it('incluye archivadas cuando includeArchived es true', async () => {
      const sort = vi.fn().mockReturnValue(execQuery([]));
      accountModel.find.mockReturnValue({ sort });

      await service.findAllByUser(userId, true);

      expect(accountModel.find).toHaveBeenCalledWith({ userId });
    });

    it('no expone el userId ni campos internos de Mongoose', async () => {
      const sort = vi.fn().mockReturnValue(execQuery([accountDocument]));
      accountModel.find.mockReturnValue({ sort });

      const [account] = await service.findAllByUser(userId);

      expect(account).not.toHaveProperty('userId');
      expect(account).not.toHaveProperty('_id');
    });
  });

  describe('findOneByUser', () => {
    it('busca la cuenta por id y userId a la vez', async () => {
      accountModel.findOne.mockReturnValue(execQuery(accountDocument));

      const result = await service.findOneByUser(userId, accountId);

      expect(accountModel.findOne).toHaveBeenCalledWith({
        _id: accountId,
        userId,
      });
      expect(result.id).toBe(accountId);
    });

    it('lanza NotFoundException si la cuenta pertenece a otro usuario', async () => {
      accountModel.findOne.mockReturnValue(execQuery(null));

      await expect(
        service.findOneByUser(otherUserId, accountId),
      ).rejects.toThrow(NotFoundException);
      expect(accountModel.findOne).toHaveBeenCalledWith({
        _id: accountId,
        userId: otherUserId,
      });
    });
  });

  describe('create', () => {
    it('asigna el userId autenticado y devuelve la cuenta creada', async () => {
      const dto = {
        name: 'Cuenta nómina',
        type: 'checking' as const,
        initialBalance: 150000,
      };
      accountModel.create.mockResolvedValue(accountDocument);

      const result = await service.create(userId, dto);

      expect(accountModel.create).toHaveBeenCalledWith({ ...dto, userId });
      expect(result).toEqual(
        expect.objectContaining({
          id: accountId,
          initialBalance: 150000,
          isArchived: false,
        }),
      );
    });
  });

  describe('update', () => {
    it('actualiza solo si la cuenta pertenece al usuario', async () => {
      const updated = { ...accountDocument, name: 'Nueva' };
      accountModel.findOneAndUpdate.mockReturnValue(execQuery(updated));

      const result = await service.update(userId, accountId, { name: 'Nueva' });

      expect(accountModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: accountId, userId },
        { $set: { name: 'Nueva' } },
        { returnDocument: 'after', runValidators: true },
      );
      expect(result.name).toBe('Nueva');
    });

    it('lanza NotFoundException si no existe o no es del usuario', async () => {
      accountModel.findOneAndUpdate.mockReturnValue(execQuery(null));

      await expect(
        service.update(otherUserId, accountId, { name: 'Nueva' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('marca la cuenta como archivada sin borrarla', async () => {
      accountModel.updateOne.mockReturnValue(
        execQuery({ matchedCount: 1, modifiedCount: 1 }),
      );

      await service.archive(userId, accountId);

      expect(accountModel.updateOne).toHaveBeenCalledWith(
        { _id: accountId, userId },
        { isArchived: true },
      );
    });

    it('lanza NotFoundException si la cuenta no es del usuario', async () => {
      accountModel.updateOne.mockReturnValue(
        execQuery({ matchedCount: 0, modifiedCount: 0 }),
      );

      await expect(service.archive(otherUserId, accountId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
