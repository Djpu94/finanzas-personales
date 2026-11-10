import { HttpErrorResponse } from '@angular/common/http';

// El backend responde 409 con un mensaje legible en `message`.
export function conflictErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status === 409) {
    const body: unknown = error.error;
    if (hasStringMessage(body)) {
      return body.message;
    }
  }
  return fallback;
}

function hasStringMessage(body: unknown): body is { message: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  );
}
