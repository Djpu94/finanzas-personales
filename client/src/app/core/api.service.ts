import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SILENT_HTTP_ERROR } from './silent-http-error';

const API_BASE_URL = '/api';

export interface HealthResponse {
  status: 'ok';
}

export interface ApiRequestOptions {
  // Evita el snackbar global cuando el llamador muestra su propio error.
  silentErrors?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(
    path: string,
    params?: Record<string, string>,
    options?: ApiRequestOptions,
  ): Observable<T> {
    return this.http.get<T>(this.buildUrl(path), {
      params,
      context: buildContext(options),
    });
  }

  post<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ): Observable<T> {
    return this.http.post<T>(this.buildUrl(path), body ?? null, {
      context: buildContext(options),
    });
  }

  patch<T>(
    path: string,
    body: unknown,
    options?: ApiRequestOptions,
  ): Observable<T> {
    return this.http.patch<T>(this.buildUrl(path), body, {
      context: buildContext(options),
    });
  }

  delete<T = void>(path: string, options?: ApiRequestOptions): Observable<T> {
    return this.http.delete<T>(this.buildUrl(path), {
      context: buildContext(options),
    });
  }

  getBlob(
    path: string,
    params?: Record<string, string>,
    options?: ApiRequestOptions,
  ): Observable<Blob> {
    return this.http.get(this.buildUrl(path), {
      params,
      responseType: 'blob',
      context: buildContext(options),
    });
  }

  getHealth(): Observable<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  private buildUrl(path: string): string {
    return `${API_BASE_URL}${path}`;
  }
}

function buildContext(options?: ApiRequestOptions): HttpContext {
  return new HttpContext().set(
    SILENT_HTTP_ERROR,
    options?.silentErrors ?? false,
  );
}
