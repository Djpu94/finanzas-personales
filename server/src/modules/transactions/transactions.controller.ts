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
import { BulkCreateTransactionsResponseDto } from './dto/bulk-create-transactions-response.dto.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { TransactionQueryDto } from './dto/transaction-query.dto.js';
import {
  TransactionPageResponseDto,
  TransactionResponseDto,
} from './dto/transaction-response.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';
import { TransactionsService } from './transactions.service.js';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: TransactionQueryDto,
  ): Promise<TransactionPageResponseDto> {
    return this.transactionsService.findPageByUser(user.id, query);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.create(user.id, dto);
  }

  // El cuerpo es un array sin tipar: cada fila se valida en el servicio para que una fila inválida no rechace el lote.
  @Post('bulk')
  createMany(
    @CurrentUser() user: RequestUser,
    @Body() rows: unknown,
  ): Promise<BulkCreateTransactionsResponseDto> {
    return this.transactionsService.createMany(user.id, rows);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.findOneByUser(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<void> {
    return this.transactionsService.remove(user.id, id);
  }
}
