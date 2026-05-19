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
  @ViewChild('wuenscheHeader') wuenscheHeader?: TemplateRef<any>;
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

  readonly searchQuery = signal<string>('');

  readonly filteredCandidates = computed<GroupMember[]>(() => {
    const state = this.resolveState();
    if (!state) return [];
    
    if (state.candidates && state.candidates.length > 0) {
      return state.candidates;
    }

    // Sonderzeichen durch Leerzeichen ersetzen (behält nur Buchstaben, Zahlen und Leerzeichen)
    const query = this.searchQuery().toLowerCase().replace(/[^\p{L}\d\s]/gu, ' ').trim();
    
    // Aktuellen Teilnehmer aus der Liste filtern
    const currentMember = this.anmeldungen().find(m => m.id === state.rowId);
    const currentPersonId = currentMember?.personId;

    const all = this.anmeldungen().filter(m => m.personId !== currentPersonId);
    
    if (!query) return all;

    const queryTokens = query.split(/\s+/);

    return all.filter(member => {
      const first = member.person?.domainAttributes?.firstName?.toLowerCase() || '';
      const last = member.person?.domainAttributes?.lastName?.toLowerCase() || '';
      const sex = member.personFields?.sexId === 1 ? 'm' : member.personFields?.sexId === 2 ? 'w' : '';
      const zip = member.personFields?.zip?.toString().toLowerCase() || '';
      const city = member.personFields?.city?.toString().toLowerCase() || '';
      
      const searchString = `${first} ${last} ${sex} ${zip} ${city}`;
      return queryTokens.every(token => searchString.includes(token));
    });
  });

  wuenscheFilterModalRef?: BsModalRef;

  readonly filterState = signal({
    nein: true,
    offen: true,
    manuell: true,
    gefunden: true,
    zugeordnet: true
  });

  readonly pendingFilterState = signal({ ...this.filterState() });
  readonly pendingSortState = signal<'asc' | 'desc' | 'none'>('none');

  private activeSortFn?: () => void;
  private activeSortDir?: 'asc' | 'desc' | 'none';

  private lastInputRows: GroupMember[] = [];
  private lastFilteredRows: GroupMember[] = [];
  private lastFilterStateStr: string = '';

  readonly hasActiveFilter = computed(() => {
    const f = this.filterState();
    return !f.nein || !f.offen || !f.manuell || !f.gefunden || !f.zugeordnet;
  });

  getFilteredRows(rows: GroupMember[]): GroupMember[] {
    if (!this.$showWuensche()) return rows;

    const f = this.filterState();
    const filterStateStr = JSON.stringify(f);
    
    if (this.lastInputRows === rows && this.lastFilterStateStr === filterStateStr) {
      return this.lastFilteredRows;
    }
    
    this.lastInputRows = rows;
    this.lastFilterStateStr = filterStateStr;

    if (f.nein && f.offen && f.manuell && f.gefunden && f.zugeordnet) {
      this.lastFilteredRows = rows;
      return this.lastFilteredRows;
    }

    this.lastFilteredRows = rows.filter(row => {
      const status = this.$wuenscheMap().get(row.id);
      if (!status || !status.hasWunsch) return f.nein;
      if (!status.allFound) return f.offen;
      if (status.hasManual) return f.manuell;
      if (!status.allSaved) return f.gefunden;
      return f.zugeordnet;
    });

    return this.lastFilteredRows;
  }

  openWuenscheFilterModal(template: TemplateRef<any>, sortFn: any, sortDir: any) {
    this.activeSortFn = sortFn;
    this.activeSortDir = sortDir || 'none';
    
    this.pendingFilterState.set({ ...this.filterState() });
    this.pendingSortState.set(this.activeSortDir!);

    this.wuenscheFilterModalRef = this.modalService.show(template, { class: 'modal-sm' });
  }

  toggleFilter(key: keyof ReturnType<typeof this.filterState>, value: boolean) {
    this.pendingFilterState.update(state => ({ ...state, [key]: value }));
  }

  resetWuenscheFilterAndSort() {
    this.pendingFilterState.set({ nein: true, offen: true, manuell: true, gefunden: true, zugeordnet: true });
    this.pendingSortState.set('none');
  }

  applyWuenscheFilterAndSort() {
    this.filterState.set({ ...this.pendingFilterState() });
    
    const targetDir = this.pendingSortState();
    let currentDir = this.activeSortDir || 'none';

    // Geht den internen Sortierzyklus von ngx-datatable durch, bis die gewünschte Richtung erreicht ist
    if (this.activeSortFn && currentDir !== targetDir) {
      while (currentDir !== targetDir) {
        this.activeSortFn();
        if (currentDir === 'none') currentDir = 'asc';
        else if (currentDir === 'asc') currentDir = 'desc';
        else if (currentDir === 'desc') currentDir = 'none';
      }
    }

    this.wuenscheFilterModalRef?.hide();
  }

  readonly wuenscheComparator = (propA: any, propB: any, rowA: GroupMember, rowB: GroupMember) => {
    const getSortValue = (row: GroupMember) => {
      const status = this.$wuenscheMap().get(row.id);
      if (!status || !status.hasWunsch) return 5;
      if (!status.allFound) return 1;
      if (status.hasManual) return 2;
      if (!status.allSaved) return 3;
      return 4;
    };

    const valA = getSortValue(rowA);
    const valB = getSortValue(rowB);

    if (valA === valB) {
      const nameA = `${rowA.person?.domainAttributes?.firstName || ''} ${rowA.person?.domainAttributes?.lastName || ''}`.trim();
      const nameB = `${rowB.person?.domainAttributes?.firstName || ''} ${rowB.person?.domainAttributes?.lastName || ''}`.trim();
      return nameA.localeCompare(nameB);
    }

    return valA - valB;
  };

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

  openResolveModal(template: TemplateRef<any>, rowId: number, fieldName: string, candidates: GroupMember[] = []) {
    const status = this.$wuenscheMap().get(rowId);
    const wunsch = status?.wuensche.find(w => w.fieldName === fieldName);
    const wunschText = wunsch?.text || wunsch?.rawValue || '';

    this.searchQuery.set(wunschText);
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

  enableManualSearch() {
    this.resolveState.update(state => state ? { ...state, candidates: [] } : null);
  }

  confirmModalSelection() {
    const state = this.resolveState();
    if (state && state.selected.length === 1) {
      this.confirmMatch(state.rowId, state.fieldName, state.selected[0]);
      this.modalRef?.hide();
    }
  }

  confirmMatch(rowId: number, fieldName: string, selectedIndexOrMember?: number | GroupMember) {
    this.$wuenscheMap.update(currentMap => {
      const newMap = new Map(currentMap);
      const oldStatus = newMap.get(rowId);
      if (!oldStatus) return newMap;

      const newStatus = { ...oldStatus, wuensche: [...oldStatus.wuensche] };
      const wIndex = newStatus.wuensche.findIndex(w => w.fieldName === fieldName);

      if (wIndex > -1) {
        const wunsch = { ...newStatus.wuensche[wIndex] };

        if (typeof selectedIndexOrMember === 'object' && selectedIndexOrMember !== null) {
          let idx = wunsch.members.findIndex(m => m.id === selectedIndexOrMember.id);
          if (idx === -1) {
            wunsch.members = [...wunsch.members, selectedIndexOrMember];
            idx = wunsch.members.length - 1;
          }
          wunsch.selectedIndex = idx;
        } else {
          wunsch.selectedIndex = selectedIndexOrMember !== undefined ? selectedIndexOrMember : 0;
        }
        
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