import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account, AccountDocument } from './account.schema.js';
import { AccountResponseDto } from './dto/account-response.dto.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

const ACCOUNT_NOT_FOUND_MESSAGE = 'Cuenta no encontrada';

function toAccountResponse(account: AccountDocument): AccountResponseDto {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    initialBalance: account.initialBalance,
    currency: account.currency,
    isArchived: account.isArchived,
    createdAt: account.createdAt ?? new Date(0),
    updatedAt: account.updatedAt ?? new Date(0),
  };
}

@Injectable()
export class AccountsService {
  constructor(
    @InjectModel(Account.name) private readonly accountModel: Model<Account>,
  ) {}

  async findAllByUser(
    userId: string,
    includeArchived = false,
  ): Promise<AccountResponseDto[]> {
    const filter = includeArchived ? { userId } : { userId, isArchived: false };
    const accounts = await this.accountModel
      .find(filter)
      .sort({ createdAt: 1 })
      .exec();
    return accounts.map(toAccountResponse);
  }

  async findOneByUser(userId: string, id: string): Promise<AccountResponseDto> {
    const account = await this.accountModel.findOne({ _id: id, userId }).exec();
    if (!account) {
      throw new NotFoundException(ACCOUNT_NOT_FOUND_MESSAGE);
    }
    return toAccountResponse(account);
  }

  async create(
    userId: string,
    dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    const account = await this.accountModel.create({ ...dto, userId });
    return toAccountResponse(account);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    const account = await this.accountModel
      .findOneAndUpdate(
        { _id: id, userId },
        { $set: dto },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
    if (!account) {
      throw new NotFoundException(ACCOUNT_NOT_FOUND_MESSAGE);
    }
    return toAccountResponse(account);
  }

  async archive(userId: string, id: string): Promise<void> {
    const result = await this.accountModel
      .updateOne({ _id: id, userId }, { isArchived: true })
      .exec();
    if (result.matchedCount === 0) {
      throw new NotFoundException(ACCOUNT_NOT_FOUND_MESSAGE);
    }
  }
}
