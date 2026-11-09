import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import type { RequestUser } from '../../common/types/request-user.interface.js';
import { AccountsService } from './accounts.service.js';
import { AccountQueryDto } from './dto/account-query.dto.js';
import { AccountResponseDto } from './dto/account-response.dto.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: AccountQueryDto,
  ): Promise<AccountResponseDto[]> {
    return this.accountsService.findAllByUser(
      user.id,
      query.includeArchived ?? false,
    );
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<void> {
    return this.accountsService.archive(user.id, id);
  }
}
