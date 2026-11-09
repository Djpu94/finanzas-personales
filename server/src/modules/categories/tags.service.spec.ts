import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Tag } from './tag.schema.js';
import { TagsService } from './tags.service.js';

type TagModelMock = {
  create: Mock;
  find: Mock;
  deleteOne: Mock;
};

function execQuery(result: unknown) {
  return { exec: vi.fn().mockResolvedValue(result) };
}

describe('TagsService', () => {
  const userId = '665f1a2b3c4d5e6f7a8b9c0d';
  const otherUserId = '665f1a2b3c4d5e6f7a8b9c0e';
  const tagId = '665f1a2b3c4d5e6f7a8b0101';

  const tagDocument = {
    id: tagId,
    name: 'viaje',
    color: '#3366FF',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  };

  let tagModel: TagModelMock;
  let service: TagsService;

  beforeEach(() => {
    tagModel = {
      create: vi.fn(),
      find: vi.fn(),
      deleteOne: vi.fn(),
    };
    service = new TagsService(tagModel as unknown as Model<Tag>);
  });

  describe('findAllByUser', () => {
    it('filtra por userId y ordena por nombre', async () => {
      const sort = vi.fn().mockReturnValue(execQuery([tagDocument]));
      tagModel.find.mockReturnValue({ sort });

      const result = await service.findAllByUser(userId);

      expect(tagModel.find).toHaveBeenCalledWith({ userId });
      expect(sort).toHaveBeenCalledWith({ name: 1 });
      expect(result).toEqual([
        expect.objectContaining({ id: tagId, name: 'viaje' }),
      ]);
      expect(result[0]).not.toHaveProperty('userId');
    });
  });

  describe('create', () => {
    it('asigna el userId autenticado', async () => {
      tagModel.create.mockResolvedValue(tagDocument);

      const result = await service.create(userId, {
        name: 'viaje',
        color: '#3366FF',
      });

      expect(tagModel.create).toHaveBeenCalledWith({
        name: 'viaje',
        color: '#3366FF',
        userId,
      });
      expect(result.id).toBe(tagId);
    });

    it('devuelve 409 si el nombre ya existe para el usuario', async () => {
      tagModel.create.mockRejectedValue({ code: 11000 });

      await expect(
        service.create(userId, { name: 'viaje', color: '#3366FF' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('borra solo si la etiqueta pertenece al usuario', async () => {
      tagModel.deleteOne.mockReturnValue(execQuery({ deletedCount: 1 }));

      await service.remove(userId, tagId);

      expect(tagModel.deleteOne).toHaveBeenCalledWith({ _id: tagId, userId });
    });

    it('lanza NotFoundException si la etiqueta no es del usuario', async () => {
      tagModel.deleteOne.mockReturnValue(execQuery({ deletedCount: 0 }));

      await expect(service.remove(otherUserId, tagId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
