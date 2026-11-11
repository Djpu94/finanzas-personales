import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { conflictErrorMessage } from '../../../shared/utils/conflict-error-message';
import { DEFAULT_TAG_COLOR, Tag } from '../models/tag.model';
import { TagsStoreService } from '../services/tags-store.service';

@Component({
  selector: 'app-tags-list',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tags-list.component.html',
  styleUrl: './tags-list.component.scss',
})
export class TagsListComponent {
  private readonly store = inject(TagsStoreService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly nameInput =
    viewChild<ElementRef<HTMLInputElement>>('nameInput');
  protected readonly tags = this.store.tags;
  protected readonly loading = this.store.loading;
  protected readonly error = this.store.error;
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    name: this.fb.control('', [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(50),
    ]),
    color: this.fb.control(DEFAULT_TAG_COLOR, [Validators.required]),
  });

  constructor() {
    this.store.load();
  }

  protected reload(): void {
    this.store.load();
  }

  protected focusNameInput(): void {
    this.nameInput()?.nativeElement.focus();
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    const { name, color } = this.form.getRawValue();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.store.create({ name: name.trim(), color }).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.reset();
        this.snackBar.open('Etiqueta creada.', 'Cerrar', { duration: 4000 });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.snackBar.open(
          conflictErrorMessage(error, 'No se pudo crear la etiqueta.'),
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  protected remove(tag: Tag): void {
    this.store.remove(tag.id).subscribe({
      next: () =>
        this.snackBar.open('Etiqueta eliminada.', 'Cerrar', { duration: 4000 }),
      error: () =>
        this.snackBar.open('No se pudo eliminar la etiqueta.', 'Cerrar', {
          duration: 5000,
        }),
    });
  }
}
