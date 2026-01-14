import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { interval, isAfter, isValid, isWithinInterval, parseISO } from 'date-fns';
import { debounceTime, distinctUntilChanged, filter, switchMap, tap } from 'rxjs';
import { GroupMember } from '../../../utils/ct-types';
import { ChurchtoolsService } from '../../services/churchtools.service';

interface Familienpreis {
  personenAnzahl5Bis12: number;
  personenAnzahlAb13: number;
  anzahlHunde: number;
  invalid: boolean;
  gesamt: number;
}

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

  getFamilienpreis(anmeldung: GroupMember): Familienpreis {
    let invalid = false;
    const birthdates = new Array<Date>();
    if (anmeldung.personFields?.birthday) {
      const birthday = parseISO(`${anmeldung.personFields.birthday}`);
      if (isValid(birthday)) birthdates.push(birthday);
      else invalid = true;
    }
    else invalid = true;
    for (let i = 2; i <= 8; i++) {
      const familienmitglied = anmeldung.fields.filter(({ name }) => name.endsWith(`Familienmitglied ${i}`));
      const geburtstag = parseISO(`${familienmitglied.find(({ name }) => name.startsWith("Geburtstag"))?.value}`);
      if (familienmitglied.length) {
        if (isValid(geburtstag)) birthdates.push(geburtstag);
        else invalid = true;
      }
    }
    let personenAnzahl5Bis12 = 0;
    let personenAnzahlAb13 = 0;
    birthdates.forEach(birthday => {
      if (isAfter(parseISO("2013-07-19"), birthday)) personenAnzahlAb13++;
      else if (isWithinInterval(birthday, interval(parseISO("2013-07-20"), parseISO("2021-07-19")))) personenAnzahl5Bis12++;
    })
    const anzahlHunde = Number(anmeldung.fields.find(({ name }) => name === "Hunde")?.value || 0);
    if (isNaN(anzahlHunde)) invalid = true;
    const gesamt = (personenAnzahl5Bis12 * 80) + (personenAnzahlAb13 * 120) + (anzahlHunde * 20) + 80;
    return { personenAnzahl5Bis12, personenAnzahlAb13, anzahlHunde, gesamt, invalid };
  }
}
