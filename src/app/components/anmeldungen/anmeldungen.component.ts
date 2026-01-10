import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { debounceTime, distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs';
import { ChurchtoolsService } from '../../services/churchtools.service';

@Component({
  selector: 'app-anmeldungen',
  imports: [CommonModule, ReactiveFormsModule, NgxDatatableModule],
  templateUrl: './anmeldungen.component.html',
  styleUrl: './anmeldungen.component.scss',
})
export class AnmeldungenComponent {
  private readonly churchToolsService = inject(ChurchtoolsService);
  private readonly fb = inject(FormBuilder);

  formGroup = this.fb.group({
    selectedYear: this.fb.control<number | null>(null),
    selectedWeek: this.fb.control<number | null>(null),
  })

  groupTypes$ = this.churchToolsService.getGroupTypes();
  jahre$ = this.churchToolsService.getJahre();
  
  solawochen$ = this.formGroup.controls.selectedYear.valueChanges.pipe(
    distinctUntilChanged(),
    debounceTime(1000),
    tap(() => this.formGroup.controls.selectedWeek.reset()),
    filter(value => !!value),
    switchMap(groupId => this.churchToolsService.getSolawochen(groupId!)),
  );

  anmeldungen$ = this.formGroup.controls.selectedWeek.valueChanges.pipe(
    distinctUntilChanged(),
    debounceTime(1000),
    filter(value => !!value),
    switchMap(groupId => this.churchToolsService.getAnmeldungen(groupId!)),
  );
}
