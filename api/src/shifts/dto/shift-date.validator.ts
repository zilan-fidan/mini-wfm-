
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsShiftDate(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    registerDecorator({
      name: 'isShiftDate',
      target: target.constructor,
      propertyName: String(propertyKey),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') {
            return false;
          }

          // Tam tarih + saat + açık UTC veya offset
          const pattern =
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

          if (!pattern.test(value)) {
            return false;
          }

          return Number.isFinite(new Date(value).getTime());
        },

        defaultMessage(args: ValidationArguments): string {
          return (
            `${args.property} geçerli bir ISO 8601 tarih ` +
            've saat dilimi bilgisi içermelidir'
          );
        },
      },
    });
  };
}
