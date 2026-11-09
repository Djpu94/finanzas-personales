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
import { CategoriesService } from './categories.service.js';
import { CategoryQueryDto } from './dto/category-query.dto.js';
import {
  CategoryResponseDto,
  CategoryTreeNodeDto,
} from './dto/category-response.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: CategoryQueryDto,
  ): Promise<CategoryResponseDto[] | CategoryTreeNodeDto[]> {
    return query.format === 'tree'
      ? this.categoriesService.findTreeByUser(user.id)
      : this.categoriesService.findFlatByUser(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<void> {
    return this.categoriesService.remove(user.id, id);
  }
}
