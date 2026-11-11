import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';
import { ApiService } from '../../../core/api.service';
import { CreateTagRequest, Tag } from '../models/tag.model';

@Injectable({ providedIn: 'root' })
export class TagsStoreService {
  private readonly api = inject(ApiService);
  private readonly tagsState = signal<Tag[]>([]);

  readonly tags = this.tagsState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .get<Tag[]>('/tags')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (tags) => this.tagsState.set(tags),
        error: () => this.error.set('No se pudieron cargar las etiquetas.'),
      });
  }

  create(request: CreateTagRequest): Observable<Tag> {
    return this.api
      .post<Tag>('/tags', request, { silentErrors: true })
      .pipe(tap((tag) => this.tagsState.update((tags) => [...tags, tag])));
  }

  remove(id: string): Observable<void> {
    return this.api
      .delete(`/tags/${id}`, { silentErrors: true })
      .pipe(
        tap(() =>
          this.tagsState.update((tags) => tags.filter((tag) => tag.id !== id)),
        ),
      );
  }
}
