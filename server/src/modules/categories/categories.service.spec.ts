import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Connection, Model } from 'mongoose';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Category, CategoryDocument } from './category.schema.js';
import {
  assertValidParent,
  buildCategoryTree,
  CategoriesService,
} from './categories.service.js';
import type { CategoryResponseDto } from './dto/category-response.dto.js';

type CategoryModelMock = {
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

const USER_ID = '665f1a2b3c4d5e6f7a8b9c0d';
const ROOT_ID = '665f1a2b3c4d5e6f7a8b0001';
const CHILD_ID = '665f1a2b3c4d5e6f7a8b0002';
const GRANDCHILD_ID = '665f1a2b3c4d5e6f7a8b0003';
const OTHER_ROOT_ID = '665f1a2b3c4d5e6f7a8b0004';

function categoryDocument(
  id: string,
  name: string,
  parentId: string | null,
): CategoryDocument {
  return {
    id,
    name,
    parentId: parentId ? new Types.ObjectId(parentId) : null,
    type: 'expense',
    color: '#FF8800',
    icon: undefined,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
  } as unknown as CategoryDocument;
}

describe('CategoriesService', () => {
  const alimentacion = categoryDocument(ROOT_ID, 'Alimentación', null);
  const supermercado = categoryDocument(CHILD_ID, 'Supermercado', ROOT_ID);
  const ecologico = categoryDocument(
    GRANDCHILD_ID,
    'Ecológico',
    CHILD_ID,
  );
  const transporte = categoryDocument(OTHER_ROOT_ID, 'Transporte', null);
  const allCategories = [alimentacion, supermercado, ecologico, transporte];

  let categoryModel: CategoryModelMock;
  let transactionsCountDocuments: Mock;
  let connection: { collection: Mock };
  let service: CategoriesService;

  beforeEach(() => {
    categoryModel = {
      create: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      findOneAndUpdate: vi.fn(),
      countDocuments: vi.fn(),
      deleteOne: vi.fn(),
    };
    transactionsCountDocuments = vi.fn().mockResolvedValue(0);
    connection = {
      collection: vi.fn().mockReturnValue({
        countDocuments: transactionsCountDocuments,
      }),
    };
    service = new CategoriesService(
      categoryModel as unknown as Model<Category>,
      connection as unknown as Connection,
    );
  });

  describe('findFlatByUser', () => {
    it('filtra por userId y devuelve la lista plana sin campos internos', async () => {
      const sort = vi.fn().mockReturnValue(execQuery(allCategories));
      categoryModel.find.mockReturnValue({ sort });

      const result = await service.findFlatByUser(USER_ID);

      expect(categoryModel.find).toHaveBeenCalledWith({ userId: USER_ID });
      expect(result).toHaveLength(4);
      expect(result[1]).toEqual(
        expect.objectContaining({
          id: CHILD_ID,
          parentId: ROOT_ID,
          icon: null,
        }),
      );
      expect(result[1]).not.toHaveProperty('userId');
      expect(result[1]).not.toHaveProperty('children');
    });
  });

  describe('findTreeByUser', () => {
    it('construye la jerarquía con más de dos niveles usando children', async () => {
      categoryModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue(execQuery(allCategories)),
      });

      const tree = await service.findTreeByUser(USER_ID);

      expect(tree.map((node) => node.name)).toEqual([
        'Alimentación',
        'Transporte',
      ]);
      const [alimentacionNode] = tree;
      expect(alimentacionNode.children.map((node) => node.name)).toEqual([
        'Supermercado',
      ]);
      expect(alimentacionNode.children[0].children).toEqual([
        expect.objectContaining({ name: 'Ecológico', children: [] }),
      ]);
    });
  });

  describe('create', () => {
    it('asigna userId y parentId null para categorías raíz', async () => {
      categoryModel.create.mockResolvedValue(alimentacion);

      const result = await service.create(USER_ID, {
        name: 'Alimentación',
        type: 'expense',
        color: '#FF8800',
      });

      expect(categoryModel.create).toHaveBeenCalledWith({
        name: 'Alimentación',
        type: 'expense',
        color: '#FF8800',
        userId: USER_ID,
        parentId: null,
      });
      expect(result.parentId).toBeNull();
    });

    it('rechaza un padre que no pertenece al usuario', async () => {
      categoryModel.findOne.mockReturnValue(execQuery(null));

      await expect(
        service.create(USER_ID, {
          name: 'Ajena',
          type: 'expense',
          color: '#FF8800',
          parentId: ROOT_ID,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(categoryModel.create).not.toHaveBeenCalled();
    });

    it('devuelve 409 si ya existe el nombre en el mismo nivel (E11000)', async () => {
      categoryModel.create.mockRejectedValue({ code: 11000 });

      await expect(
        service.create(USER_ID, {
          name: 'Supermercado',
          type: 'expense',
          color: '#FF8800',
          parentId: null,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('rechaza mover una categoría dentro de su propio descendiente', async () => {
      categoryModel.findOne.mockReturnValue(execQuery(alimentacion));
      categoryModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue(execQuery(allCategories)),
      });

      await expect(
        service.update(USER_ID, ROOT_ID, { parentId: GRANDCHILD_ID }),
      ).rejects.toThrow(
        'Una categoría no puede moverse dentro de sí misma ni de sus descendientes',
      );
      expect(categoryModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rechaza ser su propio padre', async () => {
      categoryModel.findOne.mockReturnValue(execQuery(alimentacion));
      categoryModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue(execQuery(allCategories)),
      });

      await expect(
        service.update(USER_ID, ROOT_ID, { parentId: ROOT_ID }),
      ).rejects.toThrow(BadRequestException);
    });

    it('mueve una categoría a raíz cuando parentId es null', async () => {
      categoryModel.findOne.mockReturnValue(execQuery(supermercado));
      categoryModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue(execQuery(allCategories)),
      });
      categoryModel.findOneAndUpdate.mockReturnValue(
        execQuery(categoryDocument(CHILD_ID, 'Supermercado', null)),
      );

      const result = await service.update(USER_ID, CHILD_ID, {
        parentId: null,
      });

      expect(categoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: CHILD_ID, userId: USER_ID },
        { $set: { parentId: null } },
        { returnDocument: 'after', runValidators: true },
      );
      expect(result.parentId).toBeNull();
    });

    it('no valida la jerarquía si parentId no se envía', async () => {
      categoryModel.findOne.mockReturnValue(execQuery(supermercado));
      categoryModel.findOneAndUpdate.mockReturnValue(
        execQuery(supermercado),
      );

      await service.update(USER_ID, CHILD_ID, { name: 'Super' });

      expect(categoryModel.find).not.toHaveBeenCalled();
      expect(categoryModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: CHILD_ID, userId: USER_ID },
        { $set: { name: 'Super' } },
        { returnDocument: 'after', runValidators: true },
      );
    });

    it('devuelve 409 si el renombrado colisiona en el mismo nivel', async () => {
      categoryModel.findOne.mockReturnValue(execQuery(supermercado));
      categoryModel.findOneAndUpdate.mockReturnValue({
        exec: vi.fn().mockRejectedValue({ code: 11000 }),
      });

      await expect(
        service.update(USER_ID, CHILD_ID, { name: 'Otra' }),
      ).rejects.toThrow(ConflictException);
    });

    it('lanza NotFoundException si la categoría no es del usuario', async () => {
      categoryModel.findOne.mockReturnValue(execQuery(null));

      await expect(
        service.update('665f1a2b3c4d5e6f7a8b9c0e', ROOT_ID, { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('devuelve 409 si la categoría tiene hijos', async () => {
      categoryModel.findOne.mockReturnValue(execQuery(alimentacion));
      categoryModel.countDocuments.mockReturnValue(execQuery(1));

      await expect(service.remove(USER_ID, ROOT_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(categoryModel.deleteOne).not.toHaveBeenCalled();
    });

    it('devuelve 409 si la categoría tiene transacciones asociadas', async () => {
      categoryModel.findOne.mockReturnValue(execQuery(supermercado));
      categoryModel.countDocuments.mockReturnValue(execQuery(0));
      transactionsCountDocuments.mockResolvedValue(3);

      await expect(service.remove(USER_ID, CHILD_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(transactionsCountDocuments).toHaveBeenCalledWith({
        userId: new Types.ObjectId(USER_ID),
        categoryId: new Types.ObjectId(CHILD_ID),
      });
      expect(categoryModel.deleteOne).not.toHaveBeenCalled();
    });

    it('elimina la categoría sin hijos ni transacciones', async () => {
      categoryModel.findOne.mockReturnValue(execQuery(ecologico));
      categoryModel.countDocuments.mockReturnValue(execQuery(0));
      categoryModel.deleteOne.mockReturnValue(
        execQuery({ deletedCount: 1 }),
      );

      await service.remove(USER_ID, GRANDCHILD_ID);

      expect(categoryModel.deleteOne).toHaveBeenCalledWith({
        _id: GRANDCHILD_ID,
        userId: USER_ID,
      });
    });

    it('lanza NotFoundException si la categoría no es del usuario', async () => {
      categoryModel.findOne.mockReturnValue(execQuery(null));

      await expect(service.remove(USER_ID, ROOT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

describe('buildCategoryTree', () => {
  it('devuelve un array vacío si no hay categorías', () => {
    expect(buildCategoryTree([])).toEqual([]);
  });

  it('trata como raíz una categoría cuyo padre no está en la lista', () => {
    const orphan: CategoryResponseDto = {
      id: CHILD_ID,
      name: 'Huérfana',
      parentId: ROOT_ID,
      type: 'expense',
      color: '#FF8800',
      icon: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };

    expect(buildCategoryTree([orphan])).toEqual([
      expect.objectContaining({ id: CHILD_ID, children: [] }),
    ]);
  });
});

describe('assertValidParent', () => {
  const byId = new Map<string, CategoryDocument>(
    [
      categoryDocument(ROOT_ID, 'A', null),
      categoryDocument(CHILD_ID, 'B', ROOT_ID),
      categoryDocument(GRANDCHILD_ID, 'C', CHILD_ID),
      categoryDocument(OTHER_ROOT_ID, 'D', null),
    ].map((category) => [category.id, category]),
  );

  it('acepta mover a raíz', () => {
    expect(() => assertValidParent(GRANDCHILD_ID, null, byId)).not.toThrow();
  });

  it('acepta mover a un nodo que no es descendiente', () => {
    expect(() =>
      assertValidParent(GRANDCHILD_ID, OTHER_ROOT_ID, byId),
    ).not.toThrow();
  });

  it('rechaza un ciclo de cualquier profundidad', () => {
    expect(() => assertValidParent(ROOT_ID, GRANDCHILD_ID, byId)).toThrow(
      BadRequestException,
    );
    expect(() => assertValidParent(ROOT_ID, CHILD_ID, byId)).toThrow(
      BadRequestException,
    );
  });

  it('rechaza un padre inexistente en el espacio del usuario', () => {
    expect(() =>
      assertValidParent(ROOT_ID, '665f1a2b3c4d5e6f7a8b9999', byId),
    ).toThrow(BadRequestException);
  });
});
