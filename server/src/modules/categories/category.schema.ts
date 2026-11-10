import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { HEX_COLOR_PATTERN } from '../../common/utils/hex-color.js';
import { User } from '../users/user.schema.js';

export const CATEGORY_TYPES = ['income', 'expense'] as const;

export type CategoryType = (typeof CATEGORY_TYPES)[number];

@Schema({ timestamps: true })
export class Category {
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100, type: String })
  name: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Category', default: null })
  parentId: Types.ObjectId | null;

  @Prop({ required: true, enum: CATEGORY_TYPES, type: String })
  type: CategoryType;

  @Prop({ required: true, type: String, match: HEX_COLOR_PATTERN })
  color: string;

  @Prop({ type: String, trim: true, maxlength: 50 })
  icon?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.index({ userId: 1, parentId: 1 });
CategorySchema.index({ userId: 1, name: 1, parentId: 1 }, { unique: true });
export type CategoryDocument = HydratedDocument<Category>;
