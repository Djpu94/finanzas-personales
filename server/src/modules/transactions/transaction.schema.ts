import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Account } from '../accounts/account.schema.js';
import { Category } from '../categories/category.schema.js';
import { Tag } from '../categories/tag.schema.js';
import { User } from '../users/user.schema.js';

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: TRANSACTION_TYPES, type: String })
  type: TransactionType;

  // Importe en centavos.
  @Prop({
    required: true,
    type: Number,
    min: 0,
    validate: Number.isInteger,
  })
  amount: number;

  @Prop({ required: true, type: Date })
  date: Date;

  @Prop({ required: true, trim: true, maxlength: 500, type: String })
  description: string;

  @Prop({ type: Types.ObjectId, ref: Account.name, required: true })
  accountId: Types.ObjectId;

  // Solo para transferencias: cuenta de destino.
  @Prop({ type: Types.ObjectId, ref: Account.name, default: null })
  targetAccountId: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: Category.name, default: null })
  categoryId: Types.ObjectId | null;

  @Prop({ type: [{ type: Types.ObjectId, ref: Tag.name }], default: [] })
  tagIds: Types.ObjectId[];

  @Prop({ type: String, trim: true, maxlength: 1000 })
  notes?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, accountId: 1, date: -1 });
export type TransactionDocument = HydratedDocument<Transaction>;
