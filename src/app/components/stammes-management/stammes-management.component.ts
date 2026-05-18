import { Component, computed, DestroyRef, inject, signal, HostListener } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { isValid, parseISO } from 'date-fns';
import { debounceTime, distinctUntilChanged, filter, firstValueFrom, map, pairwise, startWith, switchMap, tap, of } from 'rxjs';
import { GroupMember } from '../../../utils/ct-types';
import { ChurchtoolsService } from '../../services/churchtools.service';
import { SortableDirective } from '../../directives/sortable.directive';
import { NgTemplateOutlet } from '@angular/common';

type Participant = GroupMember;

interface GroupWrapper {
  id: string;
  participants: AnmeldungenViewModel[];
}

type AnmeldungenViewModel = Participant | GroupWrapper;

interface UnifiedFilter {
  type: 'all' | 'gender' | 'maRolle' | 'roleId';
  value: any;
}

@Component({
  selector: 'app-anmeldungen',
  standalone: true,
  imports: [ReactiveFormsModule, NgxDatatableModule, SortableDirective, NgTemplateOutlet],
  templateUrl: './stammes-management.component.html',
  styleUrl: './stammes-management.component.scss',
})

export class StammesManagementComponent {
  readonly JSON = JSON;

  private readonly churchToolsService = inject(ChurchtoolsService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly isDirty = signal<boolean>(false);

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.isDirty()) {
      $event.returnValue = true;
    }
  }

  readonly formGroup = this.fb.group({
    selectedYear: this.fb.control<number | null>(null),
    selectedWeek: this.fb.control<number | null>(null),
  });

  readonly activeFilter = signal<UnifiedFilter>({ type: 'all', value: null });

  groups = signal<AnmeldungenViewModel[][]>(Array.from({ length: 8 }, () => []));

  availableWrappers = signal<AnmeldungenViewModel[]>([{ id: 'wrap-1', participants: [] }]);


  showIds = signal<boolean>(false);
  toggleIds() {
    this.showIds.update(v => !v);
  }

  showAge = signal<boolean>(false);
  toggleAge() {
    this.showAge.update(v => !v);
  }

  details = signal<boolean>(false);
  toggleDetails() {
    this.details.update(v => !v);
  }

  isParticipant(item: AnmeldungenViewModel): item is Participant {
    return !('participants' in item);
  }

  readonly $groupTypes = toSignal(this.churchToolsService.getGroupTypes());
  readonly $jahre = toSignal(this.churchToolsService.getJahreManaged(73));

  private readonly $selectedWeek = toSignal(this.formGroup.controls.selectedWeek.valueChanges);

  private readonly solawochen$ = this.formGroup.controls.selectedYear.valueChanges.pipe(
    startWith(this.formGroup.controls.selectedYear.value),
    pairwise(),
    filter(([prev, next]) => {
      if (this.isDirty() && next !== prev) {
        const discard = confirm('Sie haben ungespeicherte Änderungen in der aktuellen Woche. Möchten Sie diese verwerfen?');
        if (!discard) {
          this.formGroup.controls.selectedYear.setValue(prev, { emitEvent: false });
          return false;
        }
      }
      return true;
    }),
    map(([prev, next]) => next),
    distinctUntilChanged(),
    debounceTime(1000),
    tap(() => {
      this.isDirty.set(false);
      this.activeFilter.set({ type: 'all', value: null });
      this.formGroup.controls.selectedWeek.reset();
      this.groups.set(Array.from({ length: 8 }, () => []));
    }),
    filter((value): value is number => !!value),
    switchMap(groupId => this.churchToolsService.getSolawochen(groupId)),
  );

  private readonly anmeldungen$ = this.formGroup.controls.selectedWeek.valueChanges.pipe(
    startWith(this.formGroup.controls.selectedWeek.value),
    pairwise(),
    filter(([prev, next]) => {
      if (this.isDirty() && next !== prev) {
        const discard = confirm('Sie haben ungespeicherte Änderungen in der aktuellen Woche. Möchten Sie diese verwerfen?');
        if (!discard) {
          this.formGroup.controls.selectedWeek.setValue(prev, { emitEvent: false });
          return false;
        }
      }
      return true;
    }),
    map(([prev, next]) => next),
    distinctUntilChanged(),
    debounceTime(1000),
    tap(() => {
      this.isDirty.set(false);
      this.activeFilter.set({ type: 'all', value: null });
      this.groups.set(Array.from({ length: 8 }, () => []));
    }),
    filter((value): value is number => !!value),
    switchMap(groupId => this.churchToolsService.getAnmeldungen(groupId)),
  );

  readonly $anmeldungen = signal<AnmeldungenViewModel[]>([]);
  readonly $errorIds = signal<number[]>([]);
  readonly $progress = signal<number>(0);
  readonly $solawochen = toSignal(this.solawochen$);

  constructor() {
    this.anmeldungen$.pipe(takeUntilDestroyed()).subscribe(data => {
      const viewModels = data.map(m => ({ ...m }));
      this.$anmeldungen.set(viewModels);
      this.$errorIds.set([]);
      this.activeFilter.set({ type: 'all', value: null });
    });
  }

  private readonly groupRoles$ = this.formGroup.controls.selectedWeek.valueChanges.pipe(
    startWith(this.formGroup.controls.selectedWeek.value),
    switchMap(weekId => weekId ? this.churchToolsService.getGroupRoles(weekId) : of([]))
  );

  public readonly dynamicRoles = toSignal(this.groupRoles$, { initialValue: [] });

  sortableOptions = {
    group: 'nested',
    animation: 150,
    fallbackOnBody: true,
    swapThreshold: 0.65
  };

  getGroupItems(group: AnmeldungenViewModel[]): AnmeldungenViewModel[] {
    return group;
  }

  getGenderClass(p: GroupMember): string {
    const sexId = p.personFields?.sexId;
    if (sexId === 1) return 'border-primary border-3 bg-blue-light'; // Boy (Blue)
    if (sexId === 2) return 'border-danger border-3 bg-red-light';   // Girl (Red)
    return 'bg-white';
  }

  saveGroups() {
    const weekId = this.formGroup.value.selectedWeek;
    if (!weekId) return;
    const serializeItem = (item: AnmeldungenViewModel): any => {
      if (this.isParticipant(item)) {
        return item.id;
      } else {
        return item.participants.map(p => serializeItem(p));
      }
    };
    const assignment = this.groups().map(group => group.map(item => serializeItem(item)));

    localStorage.setItem(`groups_week_${weekId}`, JSON.stringify(assignment));
    this.isDirty.set(false);
    alert('Gruppen lokal gespeichert!');
  }

  loadGroups() {
    const weekId = this.formGroup.value.selectedWeek;
    if (!weekId) return;

    const savedData = localStorage.getItem(`groups_week_${weekId}`);
    if (!savedData) {
      alert('Keine gespeicherten Gruppen gefunden.');
      return;
    }
    const allParticipants = this.expandParticipants([...this.$anmeldungen(), ...this.groups().flat()]);
    const participantMap = new Map<number, Participant>(allParticipants.map(p => [p.id, p]));
    let wrapCounter = 1;
    const deserializeItem = (savedItem: any): AnmeldungenViewModel | null => {
      if (Array.isArray(savedItem)) {
        const children: AnmeldungenViewModel[] = savedItem
          .map(child => deserializeItem(child))
          .filter((child): child is AnmeldungenViewModel => child !== null);

        const wrapper: GroupWrapper = {
          id: `wrap-loaded-${wrapCounter++}-${Date.now()}`,
          participants: children
        };
        return wrapper;
      } else {
        const participant = participantMap.get(Number(savedItem));
        if (participant) {
          participantMap.delete(Number(savedItem));
          return participant;
        }
        return null;
      }
    };
    const savedStructure: any[][] = JSON.parse(savedData);
    const newGroups: AnmeldungenViewModel[][] = savedStructure.map(groupArray => {
      if (!Array.isArray(groupArray)) return [];
      return groupArray
        .map(item => deserializeItem(item))
        .filter((item): item is AnmeldungenViewModel => item !== null);
    });
    const unassigned: AnmeldungenViewModel[] = Array.from(participantMap.values());
    this.groups.set(newGroups);
    this.$anmeldungen.set(unassigned);
    if (this.availableWrappers().length === 0) {
      this.availableWrappers.set([{ id: `wrap-${Date.now()}`, participants: [] }]);
    }
    this.isDirty.set(false);
  }

  async saveGroupsServer() {
    const groupId = this.formGroup.value.selectedWeek;
    if (!groupId || this.$progress() > 0) return;
    try {
      const allFields = await firstValueFrom(this.churchToolsService.getGroupMemberFields(groupId));
      const targetField = allFields.find(f => f.name === 'Stammeszugehörigkeit' || f.name === 'Gruppenzugehörigkeit');
      if (!targetField) {
        alert("Zielfeld nicht gefunden!");
        return;
      }
      const fieldId = targetField.id;
      const fieldName = targetField.name;
      this.$progress.set(0.01);
      const tasks: (() => Promise<void>)[] = [];
      this.groups().forEach((group, i) => {
        const groupName = `Stamm ${i + 1}`;
        const flatGroupParticipants = this.expandParticipants(group);

        flatGroupParticipants.forEach(member => {
          const currentServerVal = member.fields?.find(f => f.id === fieldId || f.name === fieldName)?.value;
          if (currentServerVal !== groupName) {
            tasks.push(async () => {
              const updated = await firstValueFrom(
                this.churchToolsService.updateGroupMemberFields(groupId, member.personId, { [fieldId]: groupName })
              );
              this.groups.update(gs => gs.map(g => this.updateFieldsInTree(g, member.id, updated.fields)));
            });
          }
        });
      });
      const flatUnassignedParticipants = this.expandParticipants(this.$anmeldungen());
      flatUnassignedParticipants.forEach(member => {
        const currentServerVal = member.fields?.find(f => f.id === fieldId || f.name === fieldName)?.value;
        if (currentServerVal !== null && currentServerVal !== '') {
          tasks.push(async () => {
            const updated = await firstValueFrom(
              this.churchToolsService.updateGroupMemberFields(groupId, member.personId, { [fieldId]: null })
            );
            this.$anmeldungen.update(list => this.updateFieldsInTree(list, member.id, updated.fields));
          });
        }
      });
      if (tasks.length === 0) {
        alert('Alles bereits auf dem neuesten Stand!');
        this.$progress.set(0);
        return;
      }
      const CHUNK_SIZE = 15;
      for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
        const chunk = tasks.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(task => task()));
        this.$progress.set((i + chunk.length) / tasks.length);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      this.isDirty.set(false);
      alert(`${tasks.length} Änderungen erfolgreich gespeichert!`);
    } catch (err) {
      console.error("Speicherfehler", err);
      alert("Ein Fehler ist aufgetreten beim Speichern.");
    } finally {
      this.$progress.set(0);
    }
  }

  private updateFieldsInTree(list: AnmeldungenViewModel[], targetId: number, updatedFields: any[]): AnmeldungenViewModel[] {
    return list.map(item => {
      if (this.isParticipant(item)) {
        if (item.id === targetId) {
          return { ...item, fields: updatedFields };
        }
        return item;
      } else {
        return {
          ...item,
          participants: this.updateFieldsInTree(item.participants, targetId, updatedFields)
        };
      }
    });
  }

  async saveGroupsServerSlow() {
    const groupId = this.formGroup.value.selectedWeek;
    if (!groupId || this.$progress() > 0) return;
    try {
      const allFields = await firstValueFrom(this.churchToolsService.getGroupMemberFields(groupId));
      const targetField = allFields.find(f => f.name === 'Stammeszugehörigkeit' || f.name === 'Gruppenzugehörigkeit');
      if (!targetField) {
        alert("Zielfeld nicht gefunden!");
        return;
      }
      const fieldId = targetField.id;
      const fieldName = targetField.name;
      const updates: { member: Participant, newValue: string | null, targetGroupIndex?: number }[] = [];
      this.groups().forEach((group, i) => {
        const groupName = `Stamm ${i + 1}`;
        const flatGroupParticipants = this.expandParticipants(group);
        flatGroupParticipants.forEach(member => {
          const currentServerVal = member.fields?.find(f => f.id === fieldId || f.name === fieldName)?.value;
          if (currentServerVal !== groupName) {
            updates.push({ member, newValue: groupName, targetGroupIndex: i });
          }
        });
      });
      const flatUnassignedParticipants = this.expandParticipants(this.$anmeldungen());
      flatUnassignedParticipants.forEach(member => {
        const currentServerVal = member.fields?.find(f => f.id === fieldId || f.name === fieldName)?.value;
        if (currentServerVal !== null && currentServerVal !== '') {
          updates.push({ member, newValue: null });
        }
      });
      if (updates.length === 0) {
        alert('Keine Änderungen zum Speichern gefunden.');
        return;
      }
      this.$progress.set(0.01);
      let processed = 0;
      for (const task of updates) {
        const updated = await firstValueFrom(
          this.churchToolsService.updateGroupMemberFields(groupId, task.member.personId, { [fieldId]: task.newValue })
        );
        if (task.targetGroupIndex !== undefined) {
          this.groups.update(gs =>
            gs.map((g, idx) => idx === task.targetGroupIndex ? this.updateFieldsInTree(g, task.member.id, updated.fields) : g)
          );
        } else {
          this.$anmeldungen.update(list => this.updateFieldsInTree(list, task.member.id, updated.fields));
        }
        processed++;
        this.$progress.set(processed / updates.length);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      this.isDirty.set(false);
      alert(`${updates.length} Änderungen im langsamen Modus abgeschlossen!`);
    } catch (err) {
      console.error("Fehler im langsamen Modus", err);
      alert("Ein Fehler ist im langsamen Modus aufgetreten.");
    } finally {
      this.$progress.set(0);
    }
  }

  loadGroupsServer() {
    const allParticipants = this.expandParticipants([...this.$anmeldungen(), ...this.groups().flat()]);
    const newGroups = Array.from({ length: 8 }, () => [] as AnmeldungenViewModel[]);
    const remainingInMain: AnmeldungenViewModel[] = [];
    allParticipants.forEach(p => {
      const groupField = p.fields?.find(f =>
        f.name === 'Stammeszugehörigkeit' || f.name === 'Gruppenzugehörigkeit'
      );
      const val = groupField?.value;
      if (val && typeof val === 'string') {
        const match = val.match(/\d+/);
        const groupNum = match ? parseInt(match[0], 10) : null;
        if (groupNum !== null && groupNum >= 1 && groupNum <= 8) {
          newGroups[groupNum - 1].push(p);
        } else {
          remainingInMain.push(p);
        }
      } else {
        remainingInMain.push(p);
      }
    });
    this.groups.set(newGroups);
    this.$anmeldungen.set(remainingInMain);
    this.isDirty.set(false);
  }

  onDrop(event: { item: any; from: string; to: string; oldIndex: number; newIndex: number }) {
    const { from, to, oldIndex, newIndex } = event;

    if (from === to && oldIndex === newIndex) {
      return;
    }

    let movedItem: AnmeldungenViewModel | null = null;

    if (from === 'main') {
      // 1. Get the actual item from the filtered view using oldIndex
      const currentFiltered = this.filteredParticipants();
      const targetItem = currentFiltered[oldIndex];

      if (targetItem) {
        movedItem = targetItem;
        // 2. Remove it from the master array by finding its index via matching IDs
        this.$anmeldungen.update(list => {
          const newList = [...list];
          const masterIdx = newList.findIndex(item => item.id === targetItem.id);
          if (masterIdx !== -1) {
            newList.splice(masterIdx, 1);
          }
          return newList;
        });
      }
    } else if (from === 'wrappers') {
      this.availableWrappers.update(list => {
        const newList = [...list];
        movedItem = newList.splice(oldIndex, 1)[0];
        return newList;
      });
    } else if (!isNaN(Number(from))) {
      const groupIdx = Number(from);
      this.groups.update(allGroups => {
        const newGroups = allGroups.map(g => [...g]);
        movedItem = newGroups[groupIdx].splice(oldIndex, 1)[0];
        return newGroups;
      });
    } else {
      let found = false;
      this.groups.update(allGroups => {
        const newGroups = allGroups.map(g => [...g]);
        for (let i = 0; i < newGroups.length; i++) {
          if (this.removeItemFromNestedWrapper(newGroups[i], from, oldIndex, item => movedItem = item)) {
            found = true;
            break;
          }
        }
        return newGroups;
      });
      if (!found) {
        this.$anmeldungen.update(list => {
          const newList = [...list];
          this.removeItemFromNestedWrapper(newList, from, oldIndex, item => movedItem = item);
          return newList;
        });
      }
    }

    if (!movedItem) return;

    if (to === 'main') {
      this.$anmeldungen.update(list => {
        const newList = [...list];
        newList.splice(newIndex, 0, movedItem!);
        return newList;
      });
    } else if (to === 'wrappers') {
      this.availableWrappers.update(list => {
        const newList = [...list];
        if (this.isParticipant(movedItem!)) {
          const wrapperItem: GroupWrapper = {
            id: `wrap-auto-${Date.now()}`,
            participants: [movedItem]
          };
          newList.splice(newIndex, 0, wrapperItem);
        } else {
          newList.splice(newIndex, 0, movedItem!);
        }
        return newList;
      });
    } else if (!isNaN(Number(to))) {
      const groupIdx = Number(to);
      this.groups.update(allGroups => {
        const newGroups = allGroups.map(g => [...g]);
        newGroups[groupIdx].splice(newIndex, 0, movedItem!);
        return newGroups;
      });
    } else {
      let inserted = false;
      this.groups.update(allGroups => {
        const newGroups = allGroups.map(g => [...g]);
        for (let i = 0; i < newGroups.length; i++) {
          if (this.insertItemIntoNestedWrapper(newGroups[i], to, newIndex, movedItem!)) {
            inserted = true;
            break;
          }
        }
        return newGroups;
      });
      if (!inserted) {
        this.availableWrappers.update(list => {
          const newList = [...list];
          if (this.insertItemIntoNestedWrapper(newList, to, newIndex, movedItem!)) {
            inserted = true;
          }
          return newList;
        });
      }
      if (!inserted) {
        this.$anmeldungen.update(list => {
          const newList = [...list];
          this.insertItemIntoNestedWrapper(newList, to, newIndex, movedItem!);
          return newList;
        });
      }
    }

    this.isDirty.set(true);
    if (this.availableWrappers().length === 0) {
      this.availableWrappers.update(list => {
        const nextId = `wrap-${Date.now()}`;
        return [
          ...list,
          { id: nextId, participants: [] }
        ];
      });
    }
  }

  private removeItemFromNestedWrapper(
    list: AnmeldungenViewModel[],
    targetWrapperId: string,
    indexToRemove: number,
    onSuccess: (item: AnmeldungenViewModel) => void
  ): boolean {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!this.isParticipant(item)) {
        if (item.id === targetWrapperId) {
          const targetArray = [...item.participants];
          const extracted = targetArray.splice(indexToRemove, 1)[0];
          item.participants = targetArray;
          onSuccess(extracted);
          return true;
        }
        if (this.removeItemFromNestedWrapper(item.participants, targetWrapperId, indexToRemove, onSuccess)) {
          return true;
        }
      }
    }
    return false;
  }
  private insertItemIntoNestedWrapper(
    list: AnmeldungenViewModel[],
    targetWrapperId: string,
    indexToInsert: number,
    itemToInsert: AnmeldungenViewModel
  ): boolean {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!this.isParticipant(item)) {
        if (item.id === targetWrapperId) {
          const targetArray = [...item.participants];
          targetArray.splice(indexToInsert, 0, itemToInsert);
          item.participants = targetArray;
          return true;
        }
        if (this.insertItemIntoNestedWrapper(item.participants, targetWrapperId, indexToInsert, itemToInsert)) {
          return true;
        }
      }
    }
    return false;
  }

  expandParticipants(items: AnmeldungenViewModel[]): GroupMember[] {
    let flatList: GroupMember[] = [];
    if (!items || !Array.isArray(items)) return flatList;

    items.forEach(item => {
      if (this.isParticipant(item)) {
        flatList.push(item);
      } else if (item && Array.isArray(item.participants)) {
        flatList = [...flatList, ...this.expandParticipants(item.participants)];
      }
    });
    return flatList;
  }


  getGenderCounts(group: AnmeldungenViewModel[]) {
    const participants = this.expandParticipants(group);
    return {
      boys: participants.filter(p => p.personFields?.sexId === 1).length,
      girls: participants.filter(p => p.personFields?.sexId === 2).length
    };
  }

  getAgeThisYear(birthday: any): number | null {
    if (!birthday) return null;
    const birthDate = parseISO(String(birthday));
    if (!isValid(birthDate)) return null;

    const currentYear = new Date().getFullYear();
    return currentYear - birthDate.getFullYear();
  }

  getAverageAge(group: AnmeldungenViewModel[]): number {
    const participants = this.expandParticipants(group);
    if (participants.length === 0) return 0;

    const totalAge = participants.reduce((sum, member) => {
      const age = this.getAgeThisYear(member.personFields?.birthday);
      return sum + (age || 0);
    }, 0);

    return Math.round((totalAge / participants.length) * 10) / 10; // Added 1 decimal for better precision
  }

  getAgeVariance(group: AnmeldungenViewModel[]): number {
    const participants = this.expandParticipants(group);
    if (participants.length <= 1) return 0;

    const ages = participants
      .map(m => this.getAgeThisYear(m.personFields?.birthday))
      .filter((age): age is number => age !== null);

    if (ages.length === 0) return 0;

    const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    const squaredDiffs = ages.map(age => Math.pow(age - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / ages.length;

    return Math.round(variance * 10) / 10;
  }

  searchTerm = signal<string>('');

  filteredParticipants = computed(() => {
    const query = this.searchTerm().toLowerCase().trim();
    const allElements = this.$anmeldungen();
    const currentFilter = this.activeFilter();

    if (!query && currentFilter.type === 'all') {
      return allElements;
    }

    const filterTree = (items: AnmeldungenViewModel[]): AnmeldungenViewModel[] => {
      return items
        .map(item => {
          if (this.isParticipant(item)) {
            const matchesQuery = !query || 
              item.person.domainAttributes.firstName.toLowerCase().includes(query) ||
              item.person.domainAttributes.lastName.toLowerCase().includes(query) ||
              item.id.toString().includes(query);
            let matchesDropdown = true;
            if (currentFilter.type === 'gender') {
              matchesDropdown = item.personFields?.sexId === currentFilter.value;
            } else if (currentFilter.type === 'maRolle') {
              matchesDropdown = this.getMaRolleValue(item) === currentFilter.value;
            } else if (currentFilter.type === 'roleId') {
              matchesDropdown = item.groupTypeRoleId === currentFilter.value;
            }
            return (matchesQuery && matchesDropdown) ? item : null;
          } else {
            const filteredChildren = filterTree(item.participants);
            if (filteredChildren.length > 0) {
              return { ...item, participants: filteredChildren };
            }
            return null;
          }
        })
        .filter((item): item is AnmeldungenViewModel => item !== null);
    };

    return filterTree(allElements);
  });

  updateSearch(event: Event) {
    const element = event.target as HTMLInputElement;
    this.searchTerm.set(element.value);
  }

  private getAllParticipantsInGroup(group: AnmeldungenViewModel[]): AnmeldungenViewModel[] {
    return group;
  }

  getWunschField(p: Participant): string | null {
    if (!p.fields || !Array.isArray(p.fields) || !p.fields.find(f => f.name === 'Wunsch 1')) return null;
    const wunschField1 = p.fields.find(f => f.name === 'Wunsch 1');
    const wunschField2 = p.fields.find(f => f.name === 'Wunsch 2');
    const wunsch1 = wunschField1 ? (wunschField1.value ? String(wunschField1.value).trim() : null) : null;
    const wunsch2 = wunschField2 ? (wunschField2.value ? String(wunschField2.value).trim() : null) : null;
    if (wunsch1 && wunsch2) {
      return `Wunsch 1: ${wunsch1} \nWunsch 2: ${wunsch2}`;
    } else if (wunsch1) {
      return `Wunsch 1: ${wunsch1}`;
    } else if (wunsch2) {
      return `Wunsch 2: ${wunsch2}`;
    }
    return 'Kein Wunsch angegeben';
  }

  getAnmerkungen(p: Participant): string | null {
    if (!p.fields || !Array.isArray(p.fields) || !p.fields.find(f => f.name === 'Bemerkung zur Woche')) return null;
    const Anmerkung = p.fields.find(f => f.name === 'Bemerkung zur Woche');
    const anmerkung = Anmerkung ? (Anmerkung.value ? String(Anmerkung.value).trim() : null) : null;
    if (anmerkung) {
      return anmerkung;
    }
    return null;
  }

  readonly availableMaRollen = computed(() => {
    const participants = this.expandParticipants(this.$anmeldungen());
    const rollen = new Set<string>();
    participants.forEach(p => {
      const maRolleVal = this.getMaRolleValue(p);
      if (maRolleVal) rollen.add(maRolleVal);
    });
    return Array.from(rollen).sort();
  });

  getMaRolleValue(p: Participant): string | null {
    if (!p.fields || !Array.isArray(p.fields)) return null;
    const field = p.fields.find(f => f.name === 'MA-Rolle');
    return field && field.value ? String(field.value).trim() : null;
  }

  getPoolCountForFilter(type: 'all' | 'gender' | 'maRolle' | 'roleId', value: any): number {
    const pool = this.expandParticipants(this.$anmeldungen());
    if (type === 'all') return pool.length;
    return pool.filter(p => {
      if (type === 'gender') return p.personFields?.sexId === value;
      if (type === 'maRolle') return this.getMaRolleValue(p) === value;
      if (type === 'roleId') return p.groupTypeRoleId === value;
      return false;
    }).length;
  }

  onFilterChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const val = selectElement.value;
    if (!val || val === 'all') {
      this.activeFilter.set({ type: 'all', value: null });
      return;
    }
    try {
      const parsed = JSON.parse(val) as UnifiedFilter;
      this.activeFilter.set(parsed);
    } catch (e) {
      console.error("Filter parsing error:", e);
      this.activeFilter.set({ type: 'all', value: null });
    }
  }
}