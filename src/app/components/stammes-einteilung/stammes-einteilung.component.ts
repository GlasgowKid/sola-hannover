import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { isValid, parseISO } from 'date-fns';
import { BsModalService } from 'ngx-bootstrap/modal';
import { Subject, distinctUntilChanged, firstValueFrom, of, switchMap, take } from 'rxjs';
import { getMemberAge, getMemberBirthday } from '../../../utils/age.util';
import { GroupMember } from '../../../utils/ct-types';
import { getWunschStatus } from '../../../utils/wunsch.util';
import { ChurchtoolsService } from '../../services/churchtools.service';
import { ConfirmModalComponent } from '../confirm-modal/confirm-modal.component';
import { ParticipantListComponent } from '../participant-list/participant-list.component';
import { PoolToolbarComponent } from '../pool-toolbar/pool-toolbar.component';
import { SolaSelectorComponent } from '../sola-selector/sola-selector.component';
import { StammComponent } from '../stamm/stamm.component';

export interface GroupWrapper {
  id: string;
  isWrapper: true;
  participants: GroupMember[];
  name?: string;
}

export enum GroupingOption {
  None = 'none',
  Zip = 'zip',
  City = 'city'
}

export type StammItem = GroupMember | GroupWrapper;

export interface DragPayload {
  type: 'PARTICIPANT' | 'GROUP' | 'POOL' | 'STAMM';
  sourceZone: string;
  data: any;
}

interface UnifiedFilter {
  type: 'all' | 'gender' | 'maRolle' | 'roleId' | 'age' | 'wunsch';
  value: any;
}

export enum SortOption {
  LastNameAsc = 'lastName_asc',
  LastNameDesc = 'lastName_desc',
  FirstNameAsc = 'firstName_asc',
  FirstNameDesc = 'firstName_desc',
  AgeAsc = 'age_asc',
  AgeDesc = 'age_desc',
  IdAsc = 'id_asc',
  IdDesc = 'id_desc'
}

@Component({
  selector: 'app-stammeseinteilung',
  standalone: true,
  imports: [NgxDatatableModule, SolaSelectorComponent, ParticipantListComponent, StammComponent, PoolToolbarComponent],
  templateUrl: './stammes-einteilung.component.html',
  styleUrl: './stammes-einteilung.component.scss',
})
export class StammesEinteilungComponent {
  readonly JSON = JSON;
  private readonly churchToolsService = inject(ChurchtoolsService);
  private readonly modalService = inject(BsModalService);
  readonly isDirty = signal<boolean>(false);

  readonly selectedYear = signal<number | null>(null);
  readonly selectedWeek = signal<number | null>(null);

  private readonly yearSelectedSubject = new Subject<number>();
  private readonly weekSelectedSubject = new Subject<number>();

  readonly activeFilter = signal<UnifiedFilter>({ type: 'all', value: null });
  readonly activeSort = signal<SortOption>(SortOption.LastNameAsc);

  onSortChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value as SortOption;
    this.activeSort.set(val);
  }

  readonly activeGrouping = signal<GroupingOption>(GroupingOption.None);
  onGroupingChange(event: Event) {
    this.activeGrouping.set((event.target as HTMLSelectElement).value as GroupingOption);
  }

  // STRIKTE ZONEN
  readonly $anmeldungen = signal<GroupMember[]>([]);
  readonly $staemme = signal<StammItem[][]>(Array.from({ length: 8 }, () => []));
  readonly $pools = signal<GroupWrapper[]>([
    { id: 'pool-0', isWrapper: true, participants: [] },
    { id: 'pool-1', isWrapper: true, participants: [] },
    { id: 'pool-2', isWrapper: true, participants: [] }
  ]);

  readonly allParticipants = computed(() => {
    const list: GroupMember[] = [];
    list.push(...this.$anmeldungen());
    this.$pools().forEach(p => list.push(...p.participants));
    this.$staemme().forEach(s => list.push(...this.expandParticipants(s)));
    return list;
  });

  private originalLoadedCount = 0; // Für die Sicherheitsprüfung!

  canDeactivate(): boolean {
    return !this.isDirty();
  }

  showIds = signal<boolean>(false);
  toggleIds() { this.showIds.update(v => !v); }

  details = signal<boolean>(false);
  toggleDetails() { this.details.update(v => !v); }

  // TYPESCRIPT TYPE GUARDS
  isGroupWrapper(item: any): item is GroupWrapper {
    return item && item.isWrapper === true;
  }

  getItemId(item: StammItem): string | number {
    return this.isGroupWrapper(item) ? item.id : item.id;
  }

  readonly $groupTypes = toSignal(this.churchToolsService.getGroupTypes());
  readonly $jahre = toSignal(this.churchToolsService.getJahre());

  private readonly solawochen$ = this.yearSelectedSubject.pipe(
    distinctUntilChanged(),
    switchMap(groupId => this.churchToolsService.getSolawochen(groupId)),
  );

  private readonly anmeldungen$ = this.weekSelectedSubject.pipe(
    distinctUntilChanged(),
    switchMap(groupId => this.churchToolsService.getTeilnehmer(groupId))
  );

  readonly $progress = signal<number>(0);
  readonly $solawochen = toSignal(this.solawochen$);

  constructor() {
    this.anmeldungen$.pipe(takeUntilDestroyed()).subscribe(data => {
      this.originalLoadedCount = data.length;
      this.activeFilter.set({ type: 'all', value: null });
      this.distributeParticipants(data);
    });
  }

  onYearSelected(yearId: number) {
    if (this.isDirty() && this.selectedYear() !== yearId) {
      const modalRef = this.modalService.show(ConfirmModalComponent, {
        initialState: { title: 'Ungespeicherte Änderungen', message: 'Woche verwerfen?', confirmText: 'Verwerfen', cancelText: 'Abbrechen' }
      });
      modalRef.content!.onClose.pipe(take(1)).subscribe(res => { if (res) this.doYearSelect(yearId); });
      return;
    }
    this.doYearSelect(yearId);
  }

  private doYearSelect(yearId: number) {
    this.isDirty.set(false);
    this.activeFilter.set({ type: 'all', value: null });
    this.selectedYear.set(yearId);
    this.selectedWeek.set(null);
    this.$staemme.set(Array.from({ length: 8 }, () => []));
    this.resetPools();
    this.yearSelectedSubject.next(yearId);
  }

  onWeekSelected(weekId: number) {
    if (this.isDirty() && this.selectedWeek() !== weekId) {
      const modalRef = this.modalService.show(ConfirmModalComponent, {
        initialState: { title: 'Ungespeicherte Änderungen', message: 'Woche verwerfen?', confirmText: 'Verwerfen', cancelText: 'Abbrechen' }
      });
      modalRef.content!.onClose.pipe(take(1)).subscribe(res => { if (res) this.doWeekSelect(weekId); });
      return;
    }
    this.doWeekSelect(weekId);
  }

  private doWeekSelect(weekId: number) {
    this.isDirty.set(false);
    this.activeFilter.set({ type: 'all', value: null });
    this.selectedWeek.set(weekId);
    this.$staemme.set(Array.from({ length: 8 }, () => []));
    this.resetPools();
    this.weekSelectedSubject.next(weekId);
  }

  private readonly groupRoles$ = this.weekSelectedSubject.pipe(
    switchMap(weekId => weekId ? this.churchToolsService.getGroupRoles(weekId) : of([]))
  );
  public readonly dynamicRoles = toSignal(this.groupRoles$, { initialValue: [] });

  private sortAlphabetically(list: GroupMember[]): GroupMember[] {
    return list.sort((a, b) => {
      const nameA = `${a.person.domainAttributes.lastName} ${a.person.domainAttributes.firstName}`;
      const nameB = `${b.person.domainAttributes.lastName} ${b.person.domainAttributes.firstName}`;
      return nameA.localeCompare(nameB);
    });
  }

  private resetPools() {
    this.$pools.set([
      { id: 'pool-0', isWrapper: true, participants: [] },
      { id: 'pool-1', isWrapper: true, participants: [] },
      { id: 'pool-2', isWrapper: true, participants: [] }
    ]);
  }

  // ==========================================
  // NATIVE HTML5 DRAG AND DROP LOGIC
  // ==========================================
  draggedPayload: DragPayload | null = null;
  dragOverZone = signal<string | null>(null);
  isDragging = signal<boolean>(false);

  onDragStart(event: DragEvent, payload: DragPayload) {
    this.draggedPayload = payload;
    this.isDragging.set(!payload.sourceZone.startsWith('pool-'));
    event.dataTransfer?.setData('text/plain', JSON.stringify(payload));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragEnd() {
    this.draggedPayload = null;
    this.isDragging.set(false);
    this.dragOverZone.set(null);
  }

  allowDrop(event: DragEvent, zoneId: string) {
    if (this.draggedPayload?.sourceZone === zoneId) return; // Die EIGENE Zone ist gesperrt
    event.preventDefault();
    this.dragOverZone.set(zoneId);
  }

  onDragLeave(event: DragEvent, zoneId: string) {
    if (this.dragOverZone() === zoneId) {
      this.dragOverZone.set(null);
    }
  }

  onDrop(event: DragEvent, targetZone: string) {
    if (this.draggedPayload?.sourceZone === targetZone) return;

    const payload = this.draggedPayload;
    this.draggedPayload = null;

    event.preventDefault();
    event.stopPropagation();
    this.dragOverZone.set(null);
    this.isDragging.set(false);

    // Extrahieren der Teilnehmer
    let extracted: GroupMember[] = [];
    let stammItemsToMove: StammItem[] = [];

    if (payload?.type === 'PARTICIPANT') extracted = [payload.data];
    else if (payload?.type === 'GROUP') extracted = [...payload.data.participants];
    else if (payload?.type === 'POOL') extracted = [...payload.data];
    else if (payload?.type === 'STAMM') {
      stammItemsToMove = payload.data;
      extracted = this.expandParticipants(stammItemsToMove);
    }

    if (extracted.length === 0) return;

    const idsToRemove = new Set(extracted.map(p => p.id));

    // 1. ZUERST ALLES AUS DEN QUELLEN LÖSCHEN (Deduplizierung)
    let main = this.$anmeldungen().filter(p => !idsToRemove.has(p.id));
    let pools = this.$pools().map(p => ({ ...p, participants: p.participants.filter(x => !idsToRemove.has(x.id)) }));
    let staemme = this.$staemme().map(s => {
      return s.map(item => {
        if (this.isGroupWrapper(item)) return { ...item, participants: item.participants.filter(x => !idsToRemove.has(x.id)) };
        return idsToRemove.has(item.id) ? null : item;
      }).filter(item => item !== null && (!this.isGroupWrapper(item) || item.participants.length > 0)) as StammItem[];
    });

    // 2. AM ZIELORT EINFÜGEN
    if (targetZone === 'main') {
      main.push(...extracted);
      main = this.sortAlphabetically(main);
    } else if (targetZone.startsWith('pool-')) {
      const pool = pools.find(p => p.id === targetZone);
      if (pool) {
        pool.participants.push(...extracted);
      }
    } else if (targetZone.startsWith('stamm-')) {
      const stammIdx = parseInt(targetZone.split('-')[1], 10);
      const stamm = staemme[stammIdx];

      if (payload?.type === 'STAMM') {
        stamm.push(...stammItemsToMove);
      } else {
        // Einzufügendes Element bestimmen (Pool wird zu Group)
        let itemToInsert: StammItem;
        if (extracted.length === 1) {
          itemToInsert = extracted[0];
        } else {
          const newId = payload?.type === 'GROUP' ? payload?.data.id : `wrapper-${Date.now()}`;
          const newName = payload?.type === 'GROUP' ? payload?.data.name : undefined;
          itemToInsert = { id: newId, isWrapper: true, participants: extracted, name: newName };
        }
        stamm.push(itemToInsert);
      }
    }

    // 3. 1-Element-Gruppen in Stämmen auflösen
    staemme = staemme.map(stamm => {
      return stamm.map(item => {
        if (this.isGroupWrapper(item) && item.participants.length === 1) {
          return item.participants[0];
        }
        return item;
      });
    });

    this.$anmeldungen.set(main);
    this.$pools.set(pools);
    this.$staemme.set(staemme);
    this.isDirty.set(true);

    this.validateState();
  }

  private validateState() {
    const ids = new Set<number>();
    let error = false;

    const check = (id: number) => {
      if (ids.has(id)) error = true;
      ids.add(id);
    };

    this.$anmeldungen().forEach(p => check(p.id));
    this.$pools().forEach(p => p.participants.forEach(x => check(x.id)));
    this.$staemme().forEach(s => s.forEach(item => {
      if (this.isGroupWrapper(item)) item.participants.forEach(x => check(x.id));
      else check(item.id);
    }));

    if (error || ids.size !== this.originalLoadedCount) {
      console.error("Zustand korrupt!", { expected: this.originalLoadedCount, actual: ids.size });
      this.showErrorModal("Ein Fehler ist beim Verschieben aufgetreten. Die Ansicht wird neu geladen.");
      this.loadGroupsServer();
    }
  }

  resetParticipant(item: GroupMember) {
    const idsToRemove = new Set([item.id]);

    // 1. Aus Pools und Stämmen fegen
    this.$pools.update(ps => ps.map(p => ({ ...p, participants: p.participants.filter(m => !idsToRemove.has(m.id)) })));
    this.$staemme.update(ss => ss.map(stamm => {
      return stamm.map(i => {
        if (this.isGroupWrapper(i)) return { ...i, participants: i.participants.filter(m => !idsToRemove.has(m.id)) };
        return idsToRemove.has(i.id) ? null : i;
      }).filter(i => i !== null && (!this.isGroupWrapper(i) || i.participants.length > 0)) as StammItem[];
    }));

    // 2. In Main sicherstellen, dass er genau 1x da ist und alphabetisch sortiert ist
    this.$anmeldungen.update(list => this.sortAlphabetically([item, ...list.filter(m => !idsToRemove.has(m.id))]));

    this.isDirty.set(true);
    this.validateState();
  }
  // ==========================================

  expandParticipants(items: StammItem[]): GroupMember[] {
    let flatList: GroupMember[] = [];
    items.forEach(item => {
      if (this.isGroupWrapper(item)) flatList.push(...item.participants);
      else flatList.push(item);
    });
    return flatList;
  }

  private sortString(a: string, b: string, asc: boolean): number {
    return asc ? a.localeCompare(b) : b.localeCompare(a);
  }

  private sortNumber(a: number, b: number, asc: boolean): number {
    return asc ? a - b : b - a;
  }

  private sortDate(a: string | null | undefined, b: string | null | undefined, asc: boolean): number {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;

    const dateA = parseISO(a);
    const dateB = parseISO(b);
    const validA = isValid(dateA);
    const validB = isValid(dateB);

    if (!validA && !validB) return 0;
    if (!validA) return 1;
    if (!validB) return -1;

    return asc ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
  }

  searchTerm = signal<string>('');
  filteredParticipants = computed(() => {
    const query = this.searchTerm().toLowerCase().trim();
    const all = this.$anmeldungen();
    const filter = this.activeFilter();
    const sort = this.activeSort();
    const grouping = this.activeGrouping();

    let filtered = all.filter(m => {
      let matchesQuery = !query ||
        m.person.domainAttributes.firstName.toLowerCase().includes(query) ||
        m.person.domainAttributes.lastName.toLowerCase().includes(query);

      if (!matchesQuery && query) {
        if (grouping === GroupingOption.Zip && m.personFields?.zip && String(m.personFields.zip).toLowerCase().includes(query)) {
          matchesQuery = true;
        }
        if (grouping === GroupingOption.City && m.personFields?.city && String(m.personFields.city).toLowerCase().includes(query)) {
          matchesQuery = true;
        }
      }

      let matchesDropdown = true;
      if (filter.type === 'gender') matchesDropdown = m.personFields?.sexId === filter.value;
      else if (filter.type === 'maRolle') matchesDropdown = this.getMaRolleValue(m) === filter.value;
      else if (filter.type === 'roleId') matchesDropdown = m.groupTypeRoleId === filter.value;
      else if (filter.type === 'age') {
        matchesDropdown = getMemberAge(m) === filter.value;
      }
      else if (filter.type === 'wunsch') {
        matchesDropdown = getWunschStatus(m, this.allParticipants()) === filter.value;
      }

      return matchesQuery && matchesDropdown;
    });

    let sorted = filtered.sort((a, b) => {
      switch (sort) {
        case SortOption.FirstNameAsc:
          return this.sortString(a.person.domainAttributes.firstName, b.person.domainAttributes.firstName, true);
        case SortOption.FirstNameDesc:
          return this.sortString(a.person.domainAttributes.firstName, b.person.domainAttributes.firstName, false);
        case SortOption.LastNameAsc:
          return this.sortString(`${a.person.domainAttributes.lastName} ${a.person.domainAttributes.firstName}`, `${b.person.domainAttributes.lastName} ${b.person.domainAttributes.firstName}`, true);
        case SortOption.LastNameDesc:
          return this.sortString(`${a.person.domainAttributes.lastName} ${a.person.domainAttributes.firstName}`, `${b.person.domainAttributes.lastName} ${b.person.domainAttributes.firstName}`, false);
        case SortOption.AgeAsc:
          return this.sortDate(getMemberBirthday(a), getMemberBirthday(b), false);
        case SortOption.AgeDesc:
          return this.sortDate(getMemberBirthday(a), getMemberBirthday(b), true);
        case SortOption.IdAsc:
          return this.sortNumber(a.id, b.id, true);
        case SortOption.IdDesc:
          return this.sortNumber(a.id, b.id, false);
        default:
          return 0;
      }
    });

    if (grouping === GroupingOption.None) {
      return sorted;
    }

    const grouped = new Map<string, GroupMember[]>();
    const withoutGroup: GroupMember[] = [];

    sorted.forEach(m => {
      let key = null;
      if (grouping === GroupingOption.Zip) key = m.personFields?.zip;
      if (grouping === GroupingOption.City) key = m.personFields?.city;

      if (key && String(key).trim()) {
        const k = String(key).trim();
        if (!grouped.has(k)) grouped.set(k, []);
        grouped.get(k)!.push(m);
      } else {
        withoutGroup.push(m);
      }
    });

    const result: StammItem[] = [];
    const sortedKeys = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
    const prefix = grouping === GroupingOption.Zip ? 'PLZ' : (grouping === GroupingOption.City ? 'Ort' : '');
    sortedKeys.forEach(key => {
      result.push({
        id: `wrapper-${grouping}-${key.replace(/\s/g, '')}`,
        isWrapper: true,
        participants: grouped.get(key)!,
        name: `${prefix}: ${key}`
      });
    });
    result.push(...withoutGroup);

    return result;
  });

  updateSearch(event: Event) { this.searchTerm.set((event.target as HTMLInputElement).value); }

  private isGroupField(fieldName: string): boolean {
    return fieldName === 'Stammeszugehörigkeit' || fieldName === 'Gruppenzugehörigkeit';
  }

  // CHURCHTOOLS SYNC (Pull & Push)
  async saveGroupsServer() {
    const groupId = this.selectedWeek();
    if (!groupId || this.$progress() > 0) return;
    try {
      const allFields = await firstValueFrom(this.churchToolsService.getGroupMemberFields(groupId));
      const targetField = allFields.find(f => this.isGroupField(f.name));
      if (!targetField) return this.showErrorModal('Das Zielfeld (Stammeszugehörigkeit) wurde in ChurchTools nicht gefunden!');

      this.$progress.set(0.01);
      const tasks: (() => Promise<void>)[] = [];

      this.$staemme().forEach((stamm, i) => {
        const groupName = `Stamm ${i + 1}`;
        this.expandParticipants(stamm).forEach(member => {
          const currentVal = member.fields?.find(f => f.id === targetField.id)?.value;
          if (currentVal !== groupName) {
            tasks.push(async () => { await firstValueFrom(this.churchToolsService.updateGroupMemberFields(groupId, member.personId, { [targetField.id]: groupName })); });
          }
        });
      });

      const unassigned = [...this.$anmeldungen(), ...this.expandParticipants(this.$pools())];
      unassigned.forEach(member => {
        const currentVal = member.fields?.find(f => f.id === targetField.id)?.value;
        if (currentVal !== null && currentVal !== '') {
          tasks.push(async () => { await firstValueFrom(this.churchToolsService.updateGroupMemberFields(groupId, member.personId, { [targetField.id]: null })); });
        }
      });

      if (tasks.length === 0) {
        this.$progress.set(0);
        return this.showInfoModal('Alles bereits auf dem neuesten Stand!');
      }

      for (let i = 0; i < tasks.length; i++) {
        try {
          await tasks[i]();
        } catch (err) {
          console.error('Fehler beim Speichern eines Teilnehmers:', err);
        }
        this.$progress.set((i + 1) / tasks.length);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      this.isDirty.set(false);
      this.showInfoModal(`${tasks.length} Änderungen erfolgreich gespeichert!`);
    } catch (err) {
      this.showErrorModal('Ein Fehler ist beim Speichern aufgetreten.');
    } finally {
      this.$progress.set(0);
      this.loadGroupsServer(); // Direkt frischen Stand abholen
    }
  }

  confirmLoadServer() {
    if (this.isDirty()) {
      const modalRef = this.modalService.show(ConfirmModalComponent, { initialState: { title: 'Ungespeicherte Änderungen', message: 'Verwerfen & Abrufen?', confirmText: 'Abrufen', cancelText: 'Abbrechen' } });
      modalRef.content!.onClose.pipe(take(1)).subscribe(res => { if (res) this.loadGroupsServer(); });
    } else {
      this.loadGroupsServer();
    }
  }

  async loadGroupsServer() {
    const groupId = this.selectedWeek();
    if (!groupId) return;
    try {
      const data = await firstValueFrom(this.churchToolsService.getTeilnehmer(groupId));
      this.originalLoadedCount = data.length;
      this.distributeParticipants(data);
    } catch (err) {
      console.error('Fehler beim Laden der Teilnehmer:', err);
      this.showErrorModal('Fehler beim Abrufen der aktuellen Einteilung vom Server.');
    }
  }

  private distributeParticipants(participants: GroupMember[]) {
    const newStaemme = Array.from({ length: 8 }, () => [] as StammItem[]);
    const remainingInMain: GroupMember[] = [];

    participants.forEach(p => {
      const val = p.fields?.find(f => this.isGroupField(f.name))?.value;
      if (val && typeof val === 'string') {
        const match = val.match(/\d+/);
        const groupNum = match ? parseInt(match[0], 10) : null;
        if (groupNum !== null && groupNum >= 1 && groupNum <= 8) newStaemme[groupNum - 1].push(p);
        else remainingInMain.push(p);
      } else {
        remainingInMain.push(p);
      }
    });

    this.$staemme.set(newStaemme);
    this.$anmeldungen.set(this.sortAlphabetically(remainingInMain));
    this.resetPools();
    this.isDirty.set(false);
  }

  getMaRolleValue(p: GroupMember): string | null { return p.fields?.find(f => f.name === 'MA-Rolle')?.value ? String(p.fields.find(f => f.name === 'MA-Rolle')!.value) : null; }

  readonly availableMaRollen = computed(() => {
    const rollen = new Set<string>();
    this.$anmeldungen().forEach(p => { const r = this.getMaRolleValue(p); if (r) rollen.add(r); });
    return Array.from(rollen).sort();
  });

  readonly availableAges = computed(() => {
    const ages = new Set<number | null>();
    this.$anmeldungen().forEach(p => { ages.add(getMemberAge(p)); });
    return Array.from(ages).sort((a, b) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    });
  });

  getPoolCountForFilter(type: string, value: any): number { return 0; }
  onFilterChange(event: Event) {
    const val = (event.target as HTMLSelectElement).value;
    this.activeFilter.set(val && val !== 'all' ? JSON.parse(val) : { type: 'all', value: null });
  }
  private showErrorModal(msg: string) { this.modalService.show(ConfirmModalComponent, { initialState: { title: 'Fehler', message: msg, cancelText: '', confirmText: 'Ok' } }); }
  private showInfoModal(msg: string) { this.modalService.show(ConfirmModalComponent, { initialState: { title: 'Info', message: msg, cancelText: '', confirmText: 'Ok' } }); }
}