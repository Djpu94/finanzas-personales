import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Account, AccountSchema } from '../accounts/account.schema.js';
import { BudgetsModule } from '../budgets/budgets.module.js';
import { Category, CategorySchema } from '../categories/category.schema.js';
import {
  Transaction,
  TransactionSchema,
} from '../transactions/transaction.schema.js';
import { AnalyticsController } from './analytics.controller.js';
import {
  ANALYTICS_CACHE_TTL_MS,
  AnalyticsService,
} from './analytics.service.js';

@Module({
  imports: [
    CacheModule.register({ ttl: ANALYTICS_CACHE_TTL_MS }),
    BudgetsModule,
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Account.name, schema: AccountSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
