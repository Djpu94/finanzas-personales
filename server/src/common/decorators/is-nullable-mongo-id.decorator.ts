import {
  buildMessage,
  isMongoId,
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';

export function IsNullableMongoId(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isNullableMongoId',
      validator: {
        validate: (value: unknown): boolean =>
          value === null || (typeof value === 'string' && isMongoId(value)),
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be a MongoId or null`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
