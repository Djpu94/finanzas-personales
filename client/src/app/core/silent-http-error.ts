import { HttpContextToken } from '@angular/common/http';

// Peticiones cuyo error ya muestra un mensaje específico en el componente.
export const SILENT_HTTP_ERROR = new HttpContextToken<boolean>(() => false);
