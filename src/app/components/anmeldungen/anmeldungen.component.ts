import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { addYears, interval, isAfter, isValid, isWithinInterval, parseISO } from 'date-fns';
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
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, NgxDatatableModule],
  templateUrl: './anmeldungen.component.html',
  styleUrl: './anmeldungen.component.scss',
})
export class AnmeldungenComponent {
  private readonly churchToolsService = inject(ChurchtoolsService);
  private readonly fb = inject(FormBuilder);

  readonly formGroup = this.fb.group({
    selectedYear: this.fb.control<number | null>(null),
    selectedWeek: this.fb.control<number | null>(null),
  });

  readonly $groupTypes = toSignal(this.churchToolsService.getGroupTypes());
  readonly $jahre = toSignal(this.churchToolsService.getJahre());

  private readonly solawochen$ = this.formGroup.controls.selectedYear.valueChanges.pipe(
    distinctUntilChanged(),
    debounceTime(1000),
    tap(() => this.formGroup.controls.selectedWeek.reset()),
    filter((value): value is number => !!value),
    switchMap(groupId => this.churchToolsService.getSolawochen(groupId)),
  );

  private readonly anmeldungen$ = this.formGroup.controls.selectedWeek.valueChanges.pipe(
    distinctUntilChanged(),
    debounceTime(1000),
    filter((value): value is number => !!value),
    switchMap(groupId => this.churchToolsService.getAnmeldungen(groupId)),
  );

  readonly $solawochen = toSignal(this.solawochen$);
  private readonly $rawAnmeldungen = toSignal(this.anmeldungen$);

  readonly $anmeldungen = computed<(GroupMember & { familienpreis: Familienpreis })[]>(() => {
    const anmeldungen = this.$rawAnmeldungen();
    if (!anmeldungen) return [];
    return anmeldungen.map(anmeldung => ({
      ...anmeldung,
      familienpreis: this.calculateFamilienpreis(anmeldung)
    }));
  });

  private calculateFamilienpreis(anmeldung: GroupMember): Familienpreis {
    let invalid = false;
    const birthdates = new Array<Date>();
    if (anmeldung.personFields?.birthday) {
      const birthday = parseISO(`${anmeldung.personFields.birthday}`);
      if (isValid(birthday)) birthdates.push(birthday);
      else invalid = true;
    } else {
      invalid = true;
    }

    for (let i = 2; i <= 8; i++) {
      const familienmitglied = anmeldung.fields.filter(({ name }) => name.endsWith(`Familienmitglied ${i}`));
      if (familienmitglied.length) {
         const geburtstag = parseISO(`${familienmitglied.find(({ name }) => name.startsWith("Geburtstag"))?.value}`);
         if (isValid(geburtstag)) birthdates.push(geburtstag);
         else invalid = true;
      }
    }

    let personenAnzahl5Bis12 = 0;
    let personenAnzahlAb13 = 0;
    
    const REFERENCE_DATE = parseISO("2026-07-20");
    const DATE_LIMIT_FULL = addYears(REFERENCE_DATE, -13);
    const DATE_LIMT_FREE = addYears(REFERENCE_DATE, -5);
    const REDUCED_PRICE_RANGE = interval(DATE_LIMT_FREE, DATE_LIMIT_FULL);

    birthdates.forEach(birthday => {
      if (isAfter(DATE_LIMIT_FULL, birthday)) personenAnzahlAb13++;
      else if (isWithinInterval(birthday, REDUCED_PRICE_RANGE)) personenAnzahl5Bis12++;
    });

    const anzahlHunde = Number(anmeldung.fields.find(({ name }) => name === "Hunde")?.value || 0);
    if (isNaN(anzahlHunde)) invalid = true;

    const gesamt = (personenAnzahl5Bis12 * 80) + (personenAnzahlAb13 * 120) + (anzahlHunde * 20) + 80;
    return { personenAnzahl5Bis12, personenAnzahlAb13, anzahlHunde, gesamt, invalid };
  }
}
