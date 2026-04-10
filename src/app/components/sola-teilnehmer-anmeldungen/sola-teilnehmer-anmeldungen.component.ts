import { PercentPipe } from '@angular/common';
import { Component, OnChanges, TemplateRef, ViewChild, computed, inject, input, output, signal } from '@angular/core';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { BsModalRef, BsModalService, ModalModule } from 'ngx-bootstrap/modal';
import { GroupMember } from '../../../utils/ct-types';
import { MemberUpdatePayload } from '../anmeldungen/anmeldungen.component';

export interface WunschMatch {
  fieldName: string;
  text: string;
  rawValue: string;
  members: GroupMember[];
  isExact: boolean;
  isManuallyConfirmed?: boolean;
  selectedIndex?: number;
}

export interface WunschStatus {
  hasWunsch: boolean;
  allFound: boolean;
  allSaved: boolean;
  hasManual?: boolean;
  wuensche: WunschMatch[];
}

@Component({
  selector: 'app-sola-teilnehmer-anmeldungen',
  standalone: true,
  imports: [ModalModule, NgxDatatableModule, PercentPipe],
  providers: [BsModalService],
  templateUrl: './sola-teilnehmer-anmeldungen.component.html',
  styleUrl: './sola-teilnehmer-anmeldungen.component.scss',
})
export class SolaTeilnehmerAnmeldungenComponent implements OnChanges {
  @ViewChild('wuenscheSpalte') wuenscheSpalte?: TemplateRef<{ row: GroupMember }>;
  @ViewChild('wuenscheDetails') wuenscheDetails?: TemplateRef<{ row: GroupMember }>;

  readonly anmeldungen = input.required<GroupMember[]>();
  readonly isFamiliensola = input.required<boolean>();
  readonly updateProgress = input<number>(0);
  readonly updateRequested = output<MemberUpdatePayload[]>();
  readonly $showWuensche = signal(false);
  readonly $wuenscheMap = signal<Map<number, WunschStatus>>(new Map());

  readonly $unsavedPayloads = computed<MemberUpdatePayload[]>(() => {
    const payloads: MemberUpdatePayload[] = [];

    for (const member of this.anmeldungen()) {
      const status = this.$wuenscheMap().get(member.id);
      if (!status) continue;

      const updates: { fieldName: string, value: string }[] = [];

      for (const wunsch of status.wuensche) {
        const isConfirmed = (wunsch.members.length === 1 && wunsch.isExact) || wunsch.isManuallyConfirmed;
        if (isConfirmed && !this.isAlreadyUrl(wunsch.rawValue)) {
          const targetMember = this.getConfirmedMember(wunsch);
          const value = targetMember?.person?.frontendUrl;
          if (value) {
            updates.push({ fieldName: wunsch.fieldName, value });
          }
        }
      }

      if (updates.length > 0) {
        payloads.push({ member, updates });
      }
    }
    return payloads;
  });

  readonly $unsavedIds = computed<number[]>(() => this.$unsavedPayloads().map(p => p.member.id));

  private readonly modalService = inject(BsModalService);
  modalRef?: BsModalRef;

  readonly resolveState = signal<{
    rowId: number;
    fieldName: string;
    candidates: GroupMember[];
    selected: GroupMember[];
  } | null>(null);

  ngOnChanges() {
    const raw = this.anmeldungen();
    if (!raw || raw.length === 0) {
      this.$showWuensche.set(false);
      this.$wuenscheMap.set(new Map());
      return;
    }

    const isMitarbeiter = raw.some(m => m.fields.some(f => f.name === 'MA-Rolle' && f.value));
    const show = this.isFamiliensola() === false && !isMitarbeiter;

    this.$showWuensche.set(show);

    if (show) {
      this.calculateWunschMatches(raw);
    }
  }

  private calculateWunschMatches(allMembers: GroupMember[]) {
    const resultMap = new Map<number, WunschStatus>();

    for (const row of allMembers) {
      const w1Match = this.processWunschField(row, 'Wunsch 1', allMembers);
      const w2Match = this.processWunschField(row, 'Wunsch 2', allMembers);

      const status: WunschStatus = {
        hasWunsch: !!(w1Match || w2Match),
        allFound: false,
        allSaved: false,
        wuensche: [],
      };

      let w1Success = true;
      let w2Success = true;

      if (w1Match) {
        status.wuensche.push(w1Match);
        w1Success = w1Match.members.length === 1 && w1Match.isExact;
      }

      if (w2Match) {
        status.wuensche.push(w2Match);
        w2Success = w2Match.members.length === 1 && w2Match.isExact;
      }

      status.allFound = status.hasWunsch && w1Success && w2Success;
      status.allSaved = status.allFound && status.wuensche.every(w => this.isAlreadyUrl(w.rawValue));
      resultMap.set(row.id, status);
    }

    this.$wuenscheMap.set(resultMap);
  }

  private processWunschField(row: GroupMember, fieldName: string, allMembers: GroupMember[]): WunschMatch | null {
    const field = row.fields.find(f => f.name === fieldName);
    const rawValue = field?.value ? String(field.value).trim() : '';
    if (!rawValue) return null;

    if (this.isAlreadyUrl(rawValue)) {
      const matchedMember = allMembers.find(m => m.person?.frontendUrl === rawValue);
      if (matchedMember) {
        const first = matchedMember.person?.domainAttributes?.firstName || '';
        const last = matchedMember.person?.domainAttributes?.lastName || '';
        return {
          fieldName,
          text: `${first} ${last}`.trim(),
          rawValue,
          members: [matchedMember],
          isExact: true,
        };
      }
    }

    const matchResult = this.findMatches(rawValue, row.personId, allMembers);
    return {
      fieldName,
      text: rawValue,
      rawValue,
      members: matchResult.members,
      isExact: matchResult.isExact
    };
  }

  private findMatches(wunschStr: string, currentPersonId: number, allMembers: GroupMember[]): { members: GroupMember[], isExact: boolean } {
    const wunschTokens = this.tokenizeText(wunschStr);
    if (wunschTokens.length === 0) return { members: [], isExact: false };

    const exactMatches = allMembers.filter(candidate => {
      if (candidate.personId === currentPersonId) return false;
      const first = candidate.person?.domainAttributes?.firstName || '';
      const last = candidate.person?.domainAttributes?.lastName || '';
      const candidateTokens = this.tokenizeText(`${first} ${last}`);
      return wunschTokens.every(wunschWort => candidateTokens.includes(wunschWort));
    });

    if (exactMatches.length > 0) {
      return { members: exactMatches, isExact: true };
    }

    const fuzzyMatches = allMembers.filter(candidate => {
      if (candidate.personId === currentPersonId) return false;
      const first = candidate.person?.domainAttributes?.firstName || '';
      const last = candidate.person?.domainAttributes?.lastName || '';
      const candidateTokens = this.tokenizeText(`${first} ${last}`);

      return wunschTokens.every(wunschWort => {
        return candidateTokens.some(candidateToken => this.isFuzzyMatch(wunschWort, candidateToken));
      });
    });

    return { members: fuzzyMatches, isExact: false };
  }

  private isFuzzyMatch(a: string, b: string): boolean {
    const dist = this.levenshtein(a, b);
    // Bei kurzen Wörtern (<=4) erlauben wir 1 Fehler, bei längeren Wörtern 2 Fehler
    const maxTolerance = a.length <= 4 ? 1 : 2;
    return dist <= maxTolerance;
  }

  private levenshtein(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array.from({ length: b.length + 1 }, () => new Array(a.length + 1).fill(0));
    for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  private tokenizeText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ß/g, 'ss')
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[,.-]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  private isAlreadyUrl(val: string): boolean {
    return val.startsWith('https://sola-hannover.church.tools/?q=churchdb#PersonView/searchEntry:%23');
  }

  getConfirmedMember(wunsch: WunschMatch): GroupMember | null {
    if (wunsch.isManuallyConfirmed && wunsch.selectedIndex !== undefined) {
      return wunsch.members[wunsch.selectedIndex];
    }
    if (wunsch.members.length > 0) {
      return wunsch.members[0];
    }
    return null;
  }

  openResolveModal(template: TemplateRef<any>, rowId: number, fieldName: string, candidates: GroupMember[]) {
    this.resolveState.set({
      rowId,
      fieldName,
      candidates,
      selected: [],
    });
    this.modalRef = this.modalService.show(template, { class: 'modal-lg' });
  }

  onCandidateSelect({ selected }: { selected: GroupMember[] }) {
    this.resolveState.update(state => state ? { ...state, selected: [...selected] } : null);
  }

  confirmModalSelection() {
    const state = this.resolveState();
    if (state && state.selected.length === 1) {
      const selectedIndex = state.candidates.findIndex(c => c.id === state.selected[0].id);
      this.confirmMatch(state.rowId, state.fieldName, selectedIndex);
      this.modalRef?.hide();
    }
  }

  confirmMatch(rowId: number, fieldName: string, selectedIndex?: number) {
    this.$wuenscheMap.update(currentMap => {
      const newMap = new Map(currentMap);
      const oldStatus = newMap.get(rowId);
      if (!oldStatus) return newMap;

      const newStatus = { ...oldStatus, wuensche: [...oldStatus.wuensche] };
      const wIndex = newStatus.wuensche.findIndex(w => w.fieldName === fieldName);

      if (wIndex > -1) {
        const wunsch = { ...newStatus.wuensche[wIndex] };
        wunsch.selectedIndex = selectedIndex !== undefined ? selectedIndex : 0;
        wunsch.isManuallyConfirmed = true;
        newStatus.wuensche[wIndex] = wunsch;

        let allFound = true;
        let hasManual = false;

        for (const w of newStatus.wuensche) {
          const isConfirmed = (w.members.length === 1 && w.isExact) || w.isManuallyConfirmed;
          if (!isConfirmed) {
            allFound = false;
          }
          if (w.isManuallyConfirmed) {
            hasManual = true;
          }
        }

        newStatus.allFound = allFound;
        newStatus.hasManual = hasManual;
        newStatus.allSaved = newStatus.allFound && newStatus.wuensche.every(w => this.isAlreadyUrl(w.rawValue));

        newMap.set(rowId, newStatus);
      }
      return newMap;
    });
  }

  emitUpdate() {
    const payloads = this.$unsavedPayloads();
    if (payloads.length > 0) {
      this.updateRequested.emit(payloads);
    }
  }
}