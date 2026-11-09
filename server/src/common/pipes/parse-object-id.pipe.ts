import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!OBJECT_ID_PATTERN.test(value)) {
      throw new BadRequestException('El identificador no es válido');
    }
    return value;
  }
}
