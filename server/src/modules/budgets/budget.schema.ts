import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { MONTH_KEY_PATTERN } from '../analytics/analytics-periods.js';
import { Category } from '../categories/category.schema.js';
import { User } from '../users/user.schema.js';

@Schema({ timestamps: true })
export class Budget {
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  userId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Category.name, required: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true, type: String, match: MONTH_KEY_PATTERN })
  period: string;

  // Límite en centavos.
  @Prop({
    required: true,
    type: Number,
    min: 1,
    validate: Number.isInteger,
  })
  limitAmount: number;

  @Prop({ type: Boolean, default: true })
  alertsEnabled: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const BudgetSchema = SchemaFactory.createForClass(Budget);
BudgetSchema.index({ userId: 1, categoryId: 1, period: 1 }, { unique: true });
BudgetSchema.index({ userId: 1, period: 1 });
export type BudgetDocument = HydratedDocument<Budget>;
