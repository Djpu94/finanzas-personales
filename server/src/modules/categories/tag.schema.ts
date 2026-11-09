import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { HEX_COLOR_PATTERN } from '../../common/utils/hex-color.js';
import { User } from '../users/user.schema.js';

@Schema({ timestamps: true })
export class Tag {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 50, type: String })
  name: string;

  @Prop({ required: true, type: String, match: HEX_COLOR_PATTERN })
  color: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TagSchema = SchemaFactory.createForClass(Tag);
TagSchema.index({ userId: 1, name: 1 }, { unique: true });
export type TagDocument = HydratedDocument<Tag>;
