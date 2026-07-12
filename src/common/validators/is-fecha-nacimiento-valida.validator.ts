import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_REGEX.test(value)) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function calculateAge(birthDate: Date, referenceDate: Date): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
}

@ValidatorConstraint({ name: 'isFechaNacimientoValida', async: false })
export class IsFechaNacimientoValidaConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const birthDate = parseIsoDate(value);
    if (!birthDate) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (birthDate > today) {
      return false;
    }

    const age = calculateAge(birthDate, today);
    return age >= 15 && age <= 99;
  }

  defaultMessage(): string {
    return 'fechaNacimiento debe ser una fecha válida (YYYY-MM-DD), en el pasado, con edad entre 15 y 99 años';
  }
}

export function IsFechaNacimientoValida(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: String(propertyName),
      options: validationOptions,
      constraints: [],
      validator: IsFechaNacimientoValidaConstraint,
    });
  };
}
