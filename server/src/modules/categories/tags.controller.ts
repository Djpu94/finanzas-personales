import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import type { RequestUser } from '../../common/types/request-user.interface.js';
import { CreateTagDto } from './dto/create-tag.dto.js';
import { TagResponseDto } from './dto/tag-response.dto.js';
import { TagsService } from './tags.service.js';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser): Promise<TagResponseDto[]> {
    return this.tagsService.findAllByUser(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTagDto,
  ): Promise<TagResponseDto> {
    return this.tagsService.create(user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<void> {
    return this.tagsService.remove(user.id, id);
  }
}
