import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { debounceTime, distinctUntilChanged, filter, map, mergeMap, of, switchMap, tap } from 'rxjs';
import { Group } from '../../../utils/ct-types';
import { ChurchtoolsService } from '../../services/churchtools.service';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-anmeldungen',
  imports: [CommonModule, ReactiveFormsModule],
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

  getAge(birthday: string | unknown): number | string {
    if (typeof birthday !== 'string') return '';

    const birthDate = new Date(birthday);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  getExtraField(member: any, fieldName: string): string {
    if (!member.fields) return '';
    const field = member.fields.find((f: any) => f.name === fieldName);
    return field ? field.value : '';
  }
  
  getPersonField(member: any, key: string): any {
    return member.personFields ? (member.personFields as any)[key] : null;
  }
}
