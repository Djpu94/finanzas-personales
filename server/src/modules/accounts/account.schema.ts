import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { User } from '../users/user.schema.js';

export const ACCOUNT_TYPES = [
  'checking',
  'savings',
  'cash',
  'credit_card',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

@Schema({ timestamps: true })
export class Account {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 100, type: String })
  name: string;

  @Prop({ required: true, enum: ACCOUNT_TYPES, type: String })
  type: AccountType;

  // Importe en centavos.
  @Prop({
    required: true,
    type: Number,
    default: 0,
    validate: Number.isInteger,
  })
  initialBalance: number;

  @Prop({ required: true, type: String, default: 'EUR', match: /^[A-Z]{3}$/ })
  currency: string;

  @Prop({ required: true, type: Boolean, default: false })
  isArchived: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AccountSchema = SchemaFactory.createForClass(Account);
AccountSchema.index({ userId: 1, isArchived: 1 });
export type AccountDocument = HydratedDocument<Account>;
