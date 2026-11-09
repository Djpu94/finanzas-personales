import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';
import { HEX_COLOR_PATTERN } from '../../../common/utils/hex-color.js';

export class CreateTagDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 50)
  name: string;

  @IsString()
  @Matches(HEX_COLOR_PATTERN)
  color: string;
}
