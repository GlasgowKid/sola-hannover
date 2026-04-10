import { CurrencyPipe, PercentPipe, DatePipe } from '@angular/common';
import { Component, OnChanges, TemplateRef, ViewChild, inject, input, output, signal } from '@angular/core';
import { addYears, interval, isAfter, isValid, isWithinInterval, parseISO } from 'date-fns';
import { firstValueFrom } from 'rxjs';
import { MemberStatus } from '../../../utils/ct-enums';
import { GroupMember, GroupMemberFieldGroup } from '../../../utils/ct-types';
import { ChurchtoolsService } from '../../services/churchtools.service';

const PRICES = { CHILD: 80, ADULT: 120, DOG: 20, BASE: 80 };

export interface WeiteresFamilienmitglied {
  vorname: string;
  nachname: string;
  geburtstag: Date | null;
}

export interface Familienpreis {
  personenAnzahl5Bis12: number;
  personenAnzahlAb13: number;
  anzahlHunde: number;
  invalid: boolean;
  anzahlFamilienmitglieder: number;
  gesamt: number;
  weitereMitglieder: WeiteresFamilienmitglied[];
}

export type SofaAnmeldungViewModel = GroupMember & { 
  familienpreis: Familienpreis;
  displayFields: Array<{ id: number; name: string; value: unknown; sortKey: number; }>;
};

@Component({
  selector: 'app-sofa-anmeldungen',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, PercentPipe],
  templateUrl: './sofa-anmeldungen.component.html',
  styleUrl: './sofa-anmeldungen.component.scss',
})
export class SofaAnmeldungenComponent implements OnChanges {
  @ViewChild('preisTabelle') preisTabelle?: TemplateRef<{ row: SofaAnmeldungViewModel }>;
  @ViewChild('preisSpalte') preisSpalte?: TemplateRef<{ value: number, row: SofaAnmeldungViewModel }>;
  @ViewChild('personenSpalte') personenSpalte?: TemplateRef<{ row: SofaAnmeldungViewModel }>;
  @ViewChild('familienmitgliederTabelle') familienmitgliederTabelle?: TemplateRef<{ mitglieder: WeiteresFamilienmitglied[] }>;

  readonly anmeldungen = input.required<GroupMember[]>();
  readonly priceRefDate = input.required<Date>();
  readonly groupId = input.required<number | null>();

  readonly processedData = output<SofaAnmeldungViewModel[]>();

  private readonly churchToolsService = inject(ChurchtoolsService);

  readonly $isFamiliensola = signal(false);
  readonly $internalData = signal<SofaAnmeldungViewModel[]>([]);
  readonly $progress = signal<number>(0);
  readonly $errorIds = signal<number[]>([]);

  ngOnChanges() {
    const raw = this.anmeldungen();
    if (!raw || raw.length === 0) {
      this.$isFamiliensola.set(false);
      this.$internalData.set([]);
      this.processedData.emit([]);
      return;
    }

    const processed: SofaAnmeldungViewModel[] = raw.map(m => ({
      ...m,
      familienpreis: this.calculateFamilienpreis(m),
      displayFields: m.fields.filter(f => !f.name.includes('Familienmitglied')),
    }));

    const isFamiliensola = processed.some(a => a.familienpreis.anzahlFamilienmitglieder > 1);
    this.$isFamiliensola.set(isFamiliensola);

    this.$internalData.set(processed);
    this.processedData.emit(processed);
  }

  private calculateFamilienpreis(anmeldung: GroupMember): Familienpreis {
    const birthdates: Date[] = [];
    let invalid = false;
    const weitereMitglieder: WeiteresFamilienmitglied[] = []; // <-- Array initialisieren

    const parseDate = (val: unknown): Date | null => {
      const d = parseISO(String(val));
      if (isValid(d)) return d;
      else invalid = true;
      return null;
    };

    if (anmeldung.personFields?.birthday) {
      const d = parseDate(anmeldung.personFields.birthday);
      if (d) birthdates.push(d);
    }
    else invalid = true;

    let anzahlFamilienmitglieder = 1;
    for (let i = 2; i <= 8; i++) {
      const familienmitglied = anmeldung.fields.filter(({ name, value }) => name.endsWith(`Familienmitglied ${i}`) && !!value);
      if (familienmitglied.length) {
        anzahlFamilienmitglieder++;
        
        const geburtstagFeld = familienmitglied.find(f => f.name.startsWith("Geburtstag"));
        const vornameFeld = familienmitglied.find(f => f.name.startsWith("Vorname"));
        const nachnameFeld = familienmitglied.find(f => f.name.startsWith("Nachname"));

        const geburtstag = geburtstagFeld?.value ? parseDate(geburtstagFeld?.value) : null;
        if (geburtstag) birthdates.push(geburtstag);
        else invalid = true;

        weitereMitglieder.push({
          vorname: vornameFeld?.value ? String(vornameFeld.value) : '',
          nachname: nachnameFeld?.value ? String(nachnameFeld.value) : '',
          geburtstag,
        });
      }
    }

    let personenAnzahl5Bis12 = 0;
    let personenAnzahlAb13 = 0;
    const refDate = this.priceRefDate();
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

    return { 
      personenAnzahl5Bis12, 
      personenAnzahlAb13, 
      anzahlHunde, 
      gesamt, 
      anzahlFamilienmitglieder, 
      invalid, 
      weitereMitglieder,
    };
  }

  private performSingleUpdate(groupId: number, anmeldung: SofaAnmeldungViewModel, fieldDef: GroupMemberFieldGroup): Promise<GroupMember> {
    const value = anmeldung.familienpreis.gesamt;
    const { id, name, sortKey } = fieldDef;
    const fields = [...anmeldung.fields, { id, name, value, sortKey }];
    const groupMemberStatus = MemberStatus.ACTIVE;

    return firstValueFrom(
      this.churchToolsService.updateGroupMember(groupId, anmeldung.personId, { fields, groupMemberStatus })
    );
  }

  async updateFamilienpreis() {
    const groupId = this.groupId();
    if (!groupId || this.$progress() > 0) return;

    try {
      const fields = await firstValueFrom(this.churchToolsService.getGroupMemberFields(groupId));
      const familienpreisField = fields?.find(f => f.referenceName === "familienpreis");

      const toUpdate = this.$internalData().filter(m => m.groupMemberStatus === MemberStatus.REQUESTED);
      if (!familienpreisField || toUpdate.length === 0) return;

      this.$progress.set(0.01);

      for (const [index, anmeldung] of toUpdate.entries()) {
        try {
          const updatedMember = await this.performSingleUpdate(groupId, anmeldung, familienpreisField);
          const { fields, personFields, familienpreis, displayFields } = anmeldung;
          const merged = { ...updatedMember, fields, personFields, familienpreis, displayFields };
          this.$internalData.update(list => list.map(m => m.id === merged.id ? merged : m));
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