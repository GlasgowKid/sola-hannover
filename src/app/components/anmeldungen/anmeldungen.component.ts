import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { parseISO, startOfYear } from 'date-fns';
import { Subject, distinctUntilChanged, firstValueFrom, switchMap } from 'rxjs';
import { GroupMember } from '../../../utils/ct-types';
import { ChurchtoolsService } from '../../services/churchtools.service';
import { SofaAnmeldungViewModel, SofaAnmeldungenComponent } from '../sofa-anmeldungen/sofa-anmeldungen.component';
import { SolaSelectorComponent } from '../sola-selector/sola-selector.component';
import { SolaTeilnehmerAnmeldungenComponent } from '../sola-teilnehmer-anmeldungen/sola-teilnehmer-anmeldungen.component';

export interface MemberUpdatePayload {
  member: GroupMember;
  updates: { fieldName: string; value: any }[];
}

@Component({
  selector: 'app-anmeldungen',
  standalone: true,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    NgxDatatableModule,
    SofaAnmeldungenComponent,
    SolaSelectorComponent,
    SolaTeilnehmerAnmeldungenComponent,
  ],
  templateUrl: './anmeldungen.component.html',
  styleUrl: './anmeldungen.component.scss',
})
export class AnmeldungenComponent {
  private readonly churchToolsService = inject(ChurchtoolsService);

  readonly $jahre = toSignal(this.churchToolsService.getJahre());
  readonly $selectedWeek = signal<number | null>(null);
  readonly $updateProgress = signal<number>(0);

  private readonly yearSelectedSubject = new Subject<number>();
  private readonly weekSelectedSubject = new Subject<number>();

  private readonly solawochen$ = this.yearSelectedSubject.pipe(
    distinctUntilChanged(),
    switchMap((groupId) => this.churchToolsService.getSolawochen(groupId)),
  );

  private readonly anmeldungen$ = this.weekSelectedSubject.pipe(
    distinctUntilChanged(),
    switchMap((groupId) => this.churchToolsService.getAnmeldungen(groupId)),
  );

  readonly $anmeldungen = signal<GroupMember[]>([]);
  readonly $solawochen = toSignal(this.solawochen$);

  readonly $priceRefDate = computed<Date>(() => {
    const solawoche = this.$solawochen()?.find(s => s.id === this.$selectedWeek());
    const dateStr = solawoche?.information?.dateOfFoundation;
    return dateStr ? parseISO(String(dateStr)) : startOfYear(new Date());
  });

  readonly $displayData = signal<SofaAnmeldungViewModel[]>([]);

  constructor() {
    this.anmeldungen$.pipe(takeUntilDestroyed()).subscribe((data) => {
      this.$anmeldungen.set(data);
    });
  }

  onYearSelected(yearId: number) {
    this.$anmeldungen.set([]);
    this.yearSelectedSubject.next(yearId);
  }

  onWeekSelected(weekId: number) {
    this.$selectedWeek.set(weekId);
    this.weekSelectedSubject.next(weekId);
  }

  onSofaDataProcessed(anmeldungen: SofaAnmeldungViewModel[]) {
    this.$displayData.set(anmeldungen);
  }

  async performCentralUpdate(payloads: MemberUpdatePayload[]) {
    const groupId = this.$selectedWeek();
    if (!groupId || this.$updateProgress() > 0 || payloads.length === 0) return;

    try {
      this.$updateProgress.set(0.01);

      const fieldsDefs = await firstValueFrom(this.churchToolsService.getGroupMemberFields(groupId));
      if (!fieldsDefs) return;

      for (const [index, item] of payloads.entries()) {
        try {
          let newFields = [...item.member.fields];

          for (const u of item.updates) {
            const def = fieldsDefs.find(f => f.name === u.fieldName);
            if (def) {
              newFields = newFields.filter(f => f.id !== def.id);
              newFields.push({ id: def.id, name: def.name, value: u.value, sortKey: def.sortKey });
            }
          }

          const updatedMember = await firstValueFrom(
            this.churchToolsService.updateGroupMember(groupId, item.member.personId, {
              fields: newFields,
              groupMemberStatus: item.member.groupMemberStatus
            })
          );

          item.member.fields = updatedMember.fields;
        } catch (err) {
          console.error(`Fehler ID ${item.member.id}`, err);
        }

        this.$updateProgress.set((index + 1) / payloads.length);
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate Limit
      }
      this.$anmeldungen.set([...this.$anmeldungen()]);
    } catch (err) {
      console.error("Globaler Fehler", err);
    } finally {
      setTimeout(() => this.$updateProgress.set(0), 500);
    }
  }
}