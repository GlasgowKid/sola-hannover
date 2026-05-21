import { CurrencyPipe, DatePipe, PercentPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { addYears, interval, isAfter, isValid, isWithinInterval, parseISO, startOfYear } from 'date-fns';
import { debounceTime, distinctUntilChanged, filter, firstValueFrom, map, switchMap, tap } from 'rxjs';
import { MemberStatus } from '../../../utils/ct-enums';
import { GroupMember, GroupMemberFieldGroup } from '../../../utils/ct-types';
import { ChurchtoolsService } from '../../services/churchtools.service';

const PRICES = { CHILD: 80, ADULT: 120, DOG: 20, BASE: 80 };

interface Familienpreis {
  personenAnzahl5Bis12: number;
  personenAnzahlAb13: number;
  anzahlHunde: number;
  invalid: boolean;
  anzahlFamilienmitglieder: number;
  gesamt: number;
}

type AnmeldungenViewModel = GroupMember & { familienpreis: Familienpreis };

@Component({
  selector: 'app-anmeldungen',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, NgxDatatableModule, PercentPipe],
  templateUrl: './anmeldungen.component.html',
  styleUrl: './anmeldungen.component.scss',
})
export class AnmeldungenComponent {
  private readonly churchToolsService = inject(ChurchtoolsService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly formGroup = this.fb.group({
    selectedYear: this.fb.control<number | null>(null),
    selectedWeek: this.fb.control<number | null>(null),
  });

  readonly $groupTypes = toSignal(this.churchToolsService.getGroupTypes());
  readonly $jahre = toSignal(this.churchToolsService.getJahre());

  private readonly $selectedWeek = toSignal(this.formGroup.controls.selectedWeek.valueChanges);

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

  readonly $anmeldungen = signal<AnmeldungenViewModel[]>([]);
  readonly $errorIds = signal<number[]>([]);
  readonly $progress = signal<number>(0);
  readonly $solawochen = toSignal(this.solawochen$);

  private readonly $priceRefDate = computed<Date>(() => {
    const solawoche = this.$solawochen()?.find(s => s.id === this.$selectedWeek());
    const dateStr = solawoche?.information?.dateOfFoundation;
    return dateStr ? parseISO(String(dateStr)) : startOfYear(new Date());
  });

  readonly $isFamiliensola = computed(() =>
    this.$anmeldungen().some(a => a.familienpreis.anzahlFamilienmitglieder > 1)
  );

  constructor() {
    this.anmeldungen$.pipe(takeUntilDestroyed()).subscribe(data => {
      const viewModels = data.map(m => ({ ...m, familienpreis: this.calculateFamilienpreis(m) }));
      this.$anmeldungen.set(viewModels);
      this.$errorIds.set([]);
    });
  }

  private calculateFamilienpreis(anmeldung: GroupMember): Familienpreis {
    const birthdates: Date[] = [];
    let invalid = false;

    const addDate = (val: unknown) => {
      const d = parseISO(String(val));
      if (isValid(d)) birthdates.push(d);
      else invalid = true;
    };

    if (anmeldung.personFields?.birthday) addDate(anmeldung.personFields.birthday);
    else invalid = true;

    let anzahlFamilienmitglieder = 1;
    for (let i = 2; i <= 8; i++) {
      const familienmitglied = anmeldung.fields.filter(({ name }) => name.endsWith(`Familienmitglied ${i}`));
      if (familienmitglied.length) {
        anzahlFamilienmitglieder++;
        const geburtstagFeld = familienmitglied.find(f => f.name.startsWith("Geburtstag"));
        if (geburtstagFeld?.value) addDate(geburtstagFeld?.value);
        else invalid = true;
      }
    }

    let personenAnzahl5Bis12 = 0;
    let personenAnzahlAb13 = 0;
    const refDate = this.$priceRefDate();
    const limitFull = addYears(refDate, -13);
    const limitFree = addYears(refDate, -5);
    const rangeReduced = interval(limitFree, limitFull);

    birthdates.forEach(birthday => {
      if (isAfter(limitFull, birthday)) personenAnzahlAb13++;
      else if (isWithinInterval(birthday, rangeReduced)) personenAnzahl5Bis12++;
    });

    const anzahlHunde = Number(anmeldung.fields.find(({ name }) => name === "Hunde")?.value || 0);
    if (isNaN(anzahlHunde)) invalid = true;

    const gesamt = (personenAnzahl5Bis12 * PRICES.CHILD) + (personenAnzahlAb13 * PRICES.ADULT) + (anzahlHunde * PRICES.DOG) + PRICES.BASE;
    return { personenAnzahl5Bis12, personenAnzahlAb13, anzahlHunde, gesamt, anzahlFamilienmitglieder, invalid };
  }

  private performSingleUpdate(groupId: number, anmeldung: AnmeldungenViewModel, fieldDef: GroupMemberFieldGroup): Promise<GroupMember> {
    const value = anmeldung.familienpreis.gesamt;
    const { id, name, sortKey } = fieldDef;
    const fields = [...anmeldung.fields, { id, name, value, sortKey }];
    const groupMemberStatus = MemberStatus.ACTIVE;

    return firstValueFrom(
      this.churchToolsService.updateGroupMember(groupId, anmeldung.personId, { fields, groupMemberStatus })
    );
  }

  async updateFamilienpreis() {
    const groupId = this.formGroup.value.selectedWeek;
    if (!groupId || this.$progress() > 0) return;

    try {
      const fields = await firstValueFrom(this.churchToolsService.getGroupMemberFields(groupId));
      const familienpreisField = fields?.find(f => f.referenceName === "familienpreis");

      const toUpdate = this.$anmeldungen().filter(m => m.groupMemberStatus === MemberStatus.REQUESTED);
      if (!familienpreisField || toUpdate.length === 0) return;

      this.$progress.set(0.01);

      for (const [index, anmeldung] of toUpdate.entries()) {
        try {
          const updatedMember = await this.performSingleUpdate(groupId, anmeldung, familienpreisField);
          const { fields, personFields, familienpreis } = anmeldung;
          const merged = { ...updatedMember, fields, personFields, familienpreis };
          this.$anmeldungen.update(list => list.map(m => m.id === merged.id ? merged : m));

        } catch (err) {
          console.error(`Fehler ID ${anmeldung.id}`, err);
          this.$errorIds.update(ids => [...ids, anmeldung.id]);
        }

        this.$progress.set((index + 1) / toUpdate.length);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (err) {
      console.error("Globaler Fehler", err);
    } finally {
      setTimeout(() => this.$progress.set(0), 500);
    }
  }
}
