export interface BulkTransactionErrorDto {
  // Posición de la fila en el array enviado (base 0).
  index: number;
  message: string;
}

export interface BulkCreateTransactionsResponseDto {
  inserted: number;
  failed: number;
  errors: BulkTransactionErrorDto[];
}
