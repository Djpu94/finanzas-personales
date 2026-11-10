export const ACCOUNT_TYPES = [
  'checking',
  'savings',
  'cash',
  'credit_card',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_CURRENCIES = ['EUR', 'USD', 'GBP', 'MXN'] as const;

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  // Importe en centavos.
  initialBalance: number;
  currency: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountRequest {
  name: string;
  type: AccountType;
  // Importe en centavos.
  initialBalance: number;
  currency: string;
}

export type UpdateAccountRequest = Partial<CreateAccountRequest>;

export interface AccountTypeOption {
  value: AccountType;
  label: string;
  icon: string;
}

export const ACCOUNT_TYPE_OPTIONS: readonly AccountTypeOption[] = [
  { value: 'checking', label: 'Cuenta corriente', icon: 'account_balance' },
  { value: 'savings', label: 'Ahorro', icon: 'savings' },
  { value: 'cash', label: 'Efectivo', icon: 'payments' },
  { value: 'credit_card', label: 'Tarjeta de crédito', icon: 'credit_card' },
];

export function findAccountTypeOption(type: AccountType): AccountTypeOption {
  const option = ACCOUNT_TYPE_OPTIONS.find((item) => item.value === type);
  if (!option) {
    throw new Error(`Tipo de cuenta desconocido: ${type}`);
  }
  return option;
}
