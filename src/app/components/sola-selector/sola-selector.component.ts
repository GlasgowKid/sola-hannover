import { Component, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-sola-selector',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './sola-selector.component.html',
  styleUrl: './sola-selector.component.scss',
})
export class SolaSelectorComponent {
  private readonly fb = inject(FormBuilder);

  readonly jahre = input<any[] | null | undefined>([]);
  readonly solawochen = input<any[] | null | undefined>([]);

  readonly yearSelected = output<number>();
  readonly weekSelected = output<number>();

  readonly formGroup = this.fb.group({
    selectedYear: this.fb.control<number | null>(null),
    selectedWeek: this.fb.control<number | null>(null),
  });

  constructor() {
    this.formGroup.controls.selectedYear.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((year) => {
        this.formGroup.controls.selectedWeek.reset(null, { emitEvent: false });
        if (year) {
          this.yearSelected.emit(year);
        }
      });

    this.formGroup.controls.selectedWeek.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((week) => {
        if (week) {
          this.weekSelected.emit(week);
        }
      });
  }
}