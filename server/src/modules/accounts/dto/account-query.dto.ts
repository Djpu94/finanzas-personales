import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class AccountQueryDto {
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  includeArchived?: boolean;
}
