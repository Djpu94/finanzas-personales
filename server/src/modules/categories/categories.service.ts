import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { isDuplicateKeyError } from '../../common/utils/is-duplicate-key-error.js';
import { Category, CategoryDocument } from './category.schema.js';
import {
  CategoryResponseDto,
  CategoryTreeNodeDto,
} from './dto/category-response.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

const CATEGORY_NOT_FOUND_MESSAGE = 'Categoría no encontrada';
const DUPLICATE_NAME_MESSAGE =
  'Ya existe una categoría con ese nombre en este nivel';
const PARENT_NOT_FOUND_MESSAGE = 'La categoría padre no existe';
const CYCLE_MESSAGE =
  'Una categoría no puede moverse dentro de sí misma ni de sus descendientes';
const HAS_CHILDREN_MESSAGE =
  'La categoría tiene subcategorías. Muévelas o elimínalas antes';
const HAS_TRANSACTIONS_MESSAGE =
  'La categoría tiene transacciones asociadas y no puede eliminarse';

// La colección la gestiona TransactionsModule; se consulta aquí para no acoplar módulos.
const TRANSACTIONS_COLLECTION = 'transactions';

export function toCategoryResponse(
  category: CategoryDocument,
): CategoryResponseDto {
  return {
    id: category.id,
    name: category.name,
    parentId: category.parentId ? category.parentId.toString() : null,
    type: category.type,
    color: category.color,
    icon: category.icon ?? null,
    createdAt: category.createdAt ?? new Date(0),
    updatedAt: category.updatedAt ?? new Date(0),
  };
}

export function buildCategoryTree(
  categories: CategoryResponseDto[],
): CategoryTreeNodeDto[] {
  const nodes = new Map<string, CategoryTreeNodeDto>();
  for (const category of categories) {
    nodes.set(category.id, { ...category, children: [] });
  }

  const roots: CategoryTreeNodeDto[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByName = (list: CategoryTreeNodeDto[]): void => {
    list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    list.forEach((node) => sortByName(node.children));
  };
  sortByName(roots);

  return roots;
}

// Recorre los ancestros del nuevo padre; si aparece la propia categoría, la
// mueve dentro de su descendencia y se rechaza.
export function assertValidParent(
  categoryId: string,
  newParentId: string | null,
  categoriesById: Map<string, CategoryDocument>,
): void {
  if (newParentId === null) {
    return;
  }
  if (newParentId === categoryId) {
    throw new BadRequestException(CYCLE_MESSAGE);
  }

  let ancestor = categoriesById.get(newParentId);
  if (!ancestor) {
    throw new BadRequestException(PARENT_NOT_FOUND_MESSAGE);
  }

  const visited = new Set<string>();
  while (ancestor && !visited.has(ancestor.id)) {
    if (ancestor.id === categoryId) {
      throw new BadRequestException(CYCLE_MESSAGE);
    }
    visited.add(ancestor.id);
    ancestor = ancestor.parentId
      ? categoriesById.get(ancestor.parentId.toString())
      : undefined;
  }
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<Category>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async findFlatByUser(userId: string): Promise<CategoryResponseDto[]> {
    const categories = await this.findAllDocumentsByUser(userId);
    return categories.map(toCategoryResponse);
  }

  async findTreeByUser(userId: string): Promise<CategoryTreeNodeDto[]> {
    return buildCategoryTree(await this.findFlatByUser(userId));
  }

  async create(
    userId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const parentId = dto.parentId ?? null;
    if (parentId) {
      await this.assertParentOwned(userId, parentId);
    }

    try {
      const category = await this.categoryModel.create({
        ...dto,
        userId,
        parentId,
      });
      return toCategoryResponse(category);
    } catch (error) {
      throw this.toWriteError(error);
    }
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    await this.findOwnedDocument(userId, id);

    if (dto.parentId !== undefined) {
      const categories = await this.findAllDocumentsByUser(userId);
      assertValidParent(
        id,
        dto.parentId,
        new Map(categories.map((category) => [category.id, category])),
      );
    }

    const changes = withoutUndefined({
      name: dto.name,
      type: dto.type,
      color: dto.color,
      icon: dto.icon,
      parentId: dto.parentId,
    });

    let category: CategoryDocument | null;
    try {
      category = await this.categoryModel
        .findOneAndUpdate(
          { _id: id, userId },
          { $set: changes },
          { returnDocument: 'after', runValidators: true },
        )
        .exec();
    } catch (error) {
      throw this.toWriteError(error);
    }

    if (!category) {
      throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE);
    }
    return toCategoryResponse(category);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwnedDocument(userId, id);

    const childCount = await this.categoryModel
      .countDocuments({ userId, parentId: id })
      .exec();
    if (childCount > 0) {
      throw new ConflictException(HAS_CHILDREN_MESSAGE);
    }

    const transactionCount = await this.connection
      .collection(TRANSACTIONS_COLLECTION)
      .countDocuments({
        userId: new Types.ObjectId(userId),
        categoryId: new Types.ObjectId(id),
      });
    if (transactionCount > 0) {
      throw new ConflictException(HAS_TRANSACTIONS_MESSAGE);
    }

    await this.categoryModel.deleteOne({ _id: id, userId }).exec();
  }

  private async findAllDocumentsByUser(
    userId: string,
  ): Promise<CategoryDocument[]> {
    return this.categoryModel
      .find({ userId })
      .sort({ name: 1 })
      .exec();
  }

  private async findOwnedDocument(
    userId: string,
    id: string,
  ): Promise<CategoryDocument> {
    const category = await this.categoryModel
      .findOne({ _id: id, userId })
      .exec();
    if (!category) {
      throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE);
    }
    return category;
  }

  private async assertParentOwned(
    userId: string,
    parentId: string,
  ): Promise<void> {
    const parent = await this.categoryModel
      .findOne({ _id: parentId, userId })
      .exec();
    if (!parent) {
      throw new BadRequestException(PARENT_NOT_FOUND_MESSAGE);
    }
  }

  private toWriteError(error: unknown): unknown {
    return isDuplicateKeyError(error)
      ? new ConflictException(DUPLICATE_NAME_MESSAGE)
      : error;
  }
}
