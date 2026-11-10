import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { conflictErrorMessage } from '../../../shared/utils/conflict-error-message';
import {
  CATEGORY_TYPE_OPTIONS,
  Category,
  CategoryType,
  CreateCategoryRequest,
  DEFAULT_CATEGORY_COLOR,
} from '../models/category.model';
import { CategoriesStoreService } from '../services/categories-store.service';

export interface CategoryFormData {
  category: Category | null;
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

@Component({
  selector: 'app-category-form-dialog',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-form-dialog.component.html',
  styleUrl: './category-form-dialog.component.scss',
})
export class CategoryFormDialogComponent {
  private readonly data = inject<CategoryFormData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<CategoryFormDialogComponent, Category>>(MatDialogRef);
  private readonly store = inject(CategoriesStoreService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(NonNullableFormBuilder);

  private readonly editing = this.data.category;

  protected readonly title = this.editing ? 'Editar categoría' : 'Nueva categoría';
  protected readonly typeOptions = CATEGORY_TYPE_OPTIONS;
  // Excluye la propia categoría y sus descendientes para evitar ciclos.
  protected readonly parentOptions = this.store.parentOptionsFor(
    this.editing?.id ?? null,
  );
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    name: this.fb.control(this.editing?.name ?? '', [
      Validators.required,
      Validators.maxLength(100),
    ]),
    type: this.fb.control<CategoryType>(this.editing?.type ?? 'expense', [
      Validators.required,
    ]),
    parentId: this.fb.control<string | null>(this.editing?.parentId ?? null),
    color: this.fb.control(this.editing?.color ?? DEFAULT_CATEGORY_COLOR, [
      Validators.required,
      Validators.pattern(HEX_COLOR_PATTERN),
    ]),
    icon: this.fb.control(this.editing?.icon ?? '', [
      Validators.maxLength(50),
    ]),
  });

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    const { name, type, parentId, color, icon } = this.form.getRawValue();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const request: CreateCategoryRequest = {
      name: name.trim(),
      type,
      parentId,
      color,
      icon: icon.trim() || null,
    };

    const save$ = this.editing
      ? this.store.update(this.editing.id, request)
      : this.store.create(request);

    this.saving.set(true);
    save$.subscribe({
      next: (category) => this.dialogRef.close(category),
      error: (error: unknown) => {
        this.saving.set(false);
        this.snackBar.open(
          conflictErrorMessage(
            error,
            'No se pudo guardar la categoría. Inténtalo de nuevo.',
          ),
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
