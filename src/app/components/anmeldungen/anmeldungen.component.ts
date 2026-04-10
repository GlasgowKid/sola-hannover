import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { parseISO, startOfYear } from 'date-fns';
import { Subject, distinctUntilChanged, switchMap } from 'rxjs';
import { GroupMember } from '../../../utils/ct-types';
import { ChurchtoolsService } from '../../services/churchtools.service';
import { SofaAnmeldungViewModel, SofaAnmeldungenComponent } from '../sofa-anmeldungen/sofa-anmeldungen.component';
import { SolaSelectorComponent } from '../sola-selector/sola-selector.component';

@Component({
  selector: 'app-anmeldungen',
  standalone: true,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    NgxDatatableModule,
    SofaAnmeldungenComponent,
    SolaSelectorComponent,
  ],
  templateUrl: './anmeldungen.component.html',
  styleUrl: './anmeldungen.component.scss',
})
export class AnmeldungenComponent {
  private readonly churchToolsService = inject(ChurchtoolsService);

  readonly $jahre = toSignal(this.churchToolsService.getJahre());
  readonly $selectedWeek = signal<number | null>(null);

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
}