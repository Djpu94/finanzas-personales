import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

const API_BASE_URL = '/api';

export interface HealthResponse {
  status: 'ok';
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    return this.http.get<T>(this.buildUrl(path), { params });
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>(this.buildUrl(path), body ?? null);
  }

  getHealth(): Observable<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  private buildUrl(path: string): string {
    return `${API_BASE_URL}${path}`;
  }
}
