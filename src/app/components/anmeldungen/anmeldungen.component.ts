import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { parseISO, startOfYear } from 'date-fns';
import { BsModalService } from 'ngx-bootstrap/modal';
import { Subject, distinctUntilChanged, firstValueFrom, switchMap, take } from 'rxjs';
import { GroupMember } from '../../../utils/ct-types';
import { ChurchtoolsService } from '../../services/churchtools.service';
import { ConfirmModalComponent } from '../confirm-modal/confirm-modal.component';
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
  private readonly modalService = inject(BsModalService);

  @ViewChild('sofa') sofa?: SofaAnmeldungenComponent;
  @ViewChild('solaTeilnehmer') solaTeilnehmer?: SolaTeilnehmerAnmeldungenComponent;

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
    if (!this.canDeactivate()) {
      const modalRef = this.modalService.show(ConfirmModalComponent, {
        initialState: {
          title: 'Ungespeicherte Änderungen',
          message: 'Es gibt ungespeicherte Zuordnungen. Möchten Sie das Jahr wirklich wechseln? Änderungen gehen verloren.',
          confirmText: 'Verwerfen',
          cancelText: 'Abbrechen'
        }
      });
      modalRef.content!.onClose.pipe(take(1)).subscribe(res => {
        if (res) this.forceClearAndSelectYear(yearId);
      });
      return;
    }
    this.forceClearAndSelectYear(yearId);
  }

  private forceClearAndSelectYear(yearId: number) {
    this.$anmeldungen.set([]);
    this.yearSelectedSubject.next(yearId);
  }

  onWeekSelected(weekId: number) {
    if (!this.canDeactivate()) {
      const modalRef = this.modalService.show(ConfirmModalComponent, {
        initialState: {
          title: 'Ungespeicherte Änderungen',
          message: 'Es gibt ungespeicherte Zuordnungen. Möchten Sie die Woche wirklich wechseln? Änderungen gehen verloren.',
          confirmText: 'Verwerfen',
          cancelText: 'Abbrechen'
        }
      });
      modalRef.content!.onClose.pipe(take(1)).subscribe(res => {
        if (res) this.forceClearAndSelectWeek(weekId);
      });
      return;
    }
    this.forceClearAndSelectWeek(weekId);
  }

  private forceClearAndSelectWeek(weekId: number) {
    this.$selectedWeek.set(weekId);
    this.weekSelectedSubject.next(weekId);
  }

  onSofaDataProcessed(anmeldungen: SofaAnmeldungViewModel[]) {
    this.$displayData.set(anmeldungen);
  }

  canDeactivate(): boolean {
    const sofaDirty = this.sofa ? this.sofa.$unsavedPayloads().length > 0 : false;
    const solaDirty = this.solaTeilnehmer ? this.solaTeilnehmer.$unsavedPayloads().length > 0 : false;
    return !(sofaDirty || solaDirty);
  }

  async performCentralUpdate(payloads: MemberUpdatePayload[]) {
    const groupId = this.$selectedWeek();
    if (!groupId || this.$updateProgress() > 0 || payloads.length === 0) return;

    try {
      this.$updateProgress.set(0.01);

      for (const [index, item] of payloads.entries()) {
        try {
          // ChurchTools API erwartet für individuelle Felder die Feld-ID als Key
          const ctFieldsToUpdate: Record<string, any> = {};

          for (const u of item.updates) {
            const existingField = item.member.fields.find(f => f.name === u.fieldName || f.name.toLowerCase() === u.fieldName.toLowerCase());
            if (existingField) {
              const normalizedExisting = existingField?.value == null ? '' : String(existingField.value);
              const normalizedNew = u.value == null ? '' : String(u.value);

              // Nur in den PATCH-Request aufnehmen, wenn sich der Wert wirklich geändert hat
              if (normalizedExisting !== normalizedNew) {
                ctFieldsToUpdate[existingField.id] = u.value;
              }
            } else {
              console.warn(`Feld '${u.fieldName}' wurde beim Teilnehmer nicht gefunden und übersprungen.`);
            }
          }

          if (Object.keys(ctFieldsToUpdate).length === 0) {
            this.$updateProgress.set((index + 1) / payloads.length);
            continue; // Keine echten Änderungen -> API-Call überspringen!
          }

          const updatedMember = await firstValueFrom(
            this.churchToolsService.updateGroupMember(groupId, item.member.personId, {
              fields: ctFieldsToUpdate as any
            })
          );

          // Das Original-Objekt im zentralen State aktualisieren,
          // da item.member nur ein flaches ViewModel (Klon) aus SofaAnmeldungen ist!
          const originalMember = this.$anmeldungen().find(m => m.id === item.member.id);
          if (originalMember) {
            originalMember.fields = updatedMember.fields;
          }
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