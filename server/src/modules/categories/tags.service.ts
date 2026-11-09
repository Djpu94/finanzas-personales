import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { isDuplicateKeyError } from '../../common/utils/is-duplicate-key-error.js';
import { CreateTagDto } from './dto/create-tag.dto.js';
import { TagResponseDto } from './dto/tag-response.dto.js';
import { Tag, TagDocument } from './tag.schema.js';

const TAG_NOT_FOUND_MESSAGE = 'Etiqueta no encontrada';
const DUPLICATE_TAG_MESSAGE = 'Ya existe una etiqueta con ese nombre';

function toTagResponse(tag: TagDocument): TagResponseDto {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt ?? new Date(0),
    updatedAt: tag.updatedAt ?? new Date(0),
  };
}

@Injectable()
export class TagsService {
  constructor(@InjectModel(Tag.name) private readonly tagModel: Model<Tag>) {}

  async findAllByUser(userId: string): Promise<TagResponseDto[]> {
    const tags = await this.tagModel.find({ userId }).sort({ name: 1 }).exec();
    return tags.map(toTagResponse);
  }

  async create(userId: string, dto: CreateTagDto): Promise<TagResponseDto> {
    try {
      const tag = await this.tagModel.create({ ...dto, userId });
      return toTagResponse(tag);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(DUPLICATE_TAG_MESSAGE);
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.tagModel.deleteOne({ _id: id, userId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(TAG_NOT_FOUND_MESSAGE);
    }
  }
}
