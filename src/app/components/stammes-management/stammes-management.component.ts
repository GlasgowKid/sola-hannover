import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { isValid, parseISO } from 'date-fns';
import { debounceTime, distinctUntilChanged, filter, switchMap, tap } from 'rxjs';
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

@Component({
  selector: 'app-anmeldungen',
  standalone: true,
  imports: [ReactiveFormsModule, NgxDatatableModule, SortableDirective, NgTemplateOutlet],
  templateUrl: './stammes-management.component.html',
  styleUrl: './stammes-management.component.scss',
})

export class StammesManagementComponent {
  private readonly churchToolsService = inject(ChurchtoolsService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly formGroup = this.fb.group({
    selectedYear: this.fb.control<number | null>(null),
    selectedWeek: this.fb.control<number | null>(null),
  });

  groups = signal<AnmeldungenViewModel[][]>(Array.from({ length: 8 }, () => []));

  availableWrappers = signal<GroupWrapper[]>([{ id: 'wrap-1', participants: [] }]);


  showIds = signal<boolean>(false);
  toggleIds() {
    this.showIds.update(v => !v);
  }

  showAge = signal<boolean>(false);
  toggleAge() {
    this.showAge.update(v => !v);
  }

  isParticipant(item: AnmeldungenViewModel): item is Participant {
    return !('participants' in item);
  }

  readonly $groupTypes = toSignal(this.churchToolsService.getGroupTypes());
  readonly $jahre = toSignal(this.churchToolsService.getJahreManaged(73));

  private readonly $selectedWeek = toSignal(this.formGroup.controls.selectedWeek.valueChanges);

  private readonly solawochen$ = this.formGroup.controls.selectedYear.valueChanges.pipe(
    distinctUntilChanged(),
    debounceTime(1000),
    tap(() => {
      this.formGroup.controls.selectedWeek.reset();
      this.groups.set(Array.from({ length: 8 }, () => []));
    }),
    filter((value): value is number => !!value),
    switchMap(groupId => this.churchToolsService.getSolawochen(groupId)),
  );

  private readonly anmeldungen$ = this.formGroup.controls.selectedWeek.valueChanges.pipe(
    distinctUntilChanged(),
    debounceTime(1000),
    tap(() => {
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
    });
  }

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
    const assignment = this.groups().map(group => group.map(p => p.id));
    localStorage.setItem(`groups_week_${weekId}`, JSON.stringify(assignment));
    alert('Gruppen lokal gespeichert!');
  }

  async saveGroupsServer() {
    /*
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
        group.forEach(member => {
          const currentServerVal = member.fields.find(f => f.id === fieldId || f.name === fieldName)?.value;
          if (currentServerVal !== groupName) {
            tasks.push(async () => {
              const updated = await firstValueFrom(this.churchToolsService.updateGroupMemberFields(groupId, member.personId, { [fieldId]: groupName }));
              this.groups.update(gs => {
                const newGs = [...gs];
                newGs[i] = newGs[i].map(m => m.id === member.id ? { ...m, fields: updated.fields } : m);
                return newGs;
              });
            });
          }
        });
      });
      this.$anmeldungen().forEach(member => {
        const currentServerVal = member.fields.find(f => f.id === fieldId || f.name === fieldName)?.value;
        if (currentServerVal !== null && currentServerVal !== '') {
          tasks.push(async () => {
            const updated = await firstValueFrom(this.churchToolsService.updateGroupMemberFields(groupId, member.personId, { [fieldId]: null }));
            this.$anmeldungen.update(list => list.map(m => m.id === member.id ? { ...m, fields: updated.fields } : m));
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
      alert(`${tasks.length} Änderungen erfolgreich gespeichert!`);
    } catch (err) {
      console.error("Speicherfehler", err);
      alert("Ein Fehler ist aufgetreten beim Speichern.");
    } finally {
      this.$progress.set(0);
    }
      */
  }
  async saveGroupsServerSlow() {
    /*
      const groupId = this.formGroup.value.selectedWeek;
      if (!groupId || this.$progress() > 0) return;
  
      try {
        const allFields = await firstValueFrom(this.churchToolsService.getGroupMemberFields(groupId));
        const targetField = allFields.find(f => f.name === 'Stammeszugehörigkeit' || f.name === 'Gruppenzugehörigkeit');
        if (!targetField) return;
        const fieldId = targetField.id;
        const fieldName = targetField.name;
        const currentGroups = this.groups();
        const unassigned = this.$anmeldungen();
        const updates: { member: AnmeldungenViewModel, newValue: string | null, targetGroupIndex?: number }[] = [];
        currentGroups.forEach((group, i) => {
          const groupName = `Stamm ${i + 1}`;
          group.forEach(member => {
            const currentServerVal = member.fields.find(f => f.id === fieldId || f.name === fieldName)?.value;
            if (currentServerVal !== groupName) {
              updates.push({ member, newValue: groupName, targetGroupIndex: i });
            }
          });
        });
        unassigned.forEach(member => {
          const currentServerVal = member.fields.find(f => f.id === fieldId || f.name === fieldName)?.value;
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
            this.groups.update(gs => {
              const newGs = [...gs];
              newGs[task.targetGroupIndex!] = newGs[task.targetGroupIndex!].map(m =>
                m.id === task.member.id ? { ...m, fields: updated.fields } : m
              );
              return newGs;
            });
          } else {
            this.$anmeldungen.update(list => list.map(m =>
              m.id === task.member.id ? { ...m, fields: updated.fields } : m
            ));
          }
          processed++;
          this.$progress.set(processed / updates.length);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        alert(`${updates.length} Änderungen im langsamen Modus abgeschlossen!`);
      } catch (err) {
        console.error("Fehler im langsamen Modus", err);
        alert("Ein Fehler ist im langsamen Modus aufgetreten.");
      } finally {
        this.$progress.set(0);
      }
      */
  }

  loadGroups() {
    /*
    const weekId = this.formGroup.value.selectedWeek;
    if (!weekId) return;
    const savedData = localStorage.getItem(`groups_week_${weekId}`);
    if (!savedData) {
      alert('Keine gespeicherten Gruppen gefunden.');
      return;
    }
    const allParticipants = [...this.$anmeldungen(), ...this.groups().flat()];
    const savedGroupIds: number[][] = JSON.parse(savedData);
    const flatSavedIds = savedGroupIds.flat();
    const newGroups: AnmeldungenViewModel[][] = savedGroupIds.map(ids =>
      allParticipants.filter(p => ids.includes(p.id))
    );
    const unassigned = allParticipants.filter(p => !flatSavedIds.includes(p.id));
    this.groups.set(newGroups);
    this.$anmeldungen.set(unassigned);
    */
  }

  loadGroupsServer() {
    /*
    const allParticipants = [...this.$anmeldungen(), ...this.groups().flat()];
    const newGroups = Array.from({ length: 8 }, () => [] as AnmeldungenViewModel[]);
    const remainingInMain: AnmeldungenViewModel[] = [];
    allParticipants.forEach(p => {
      const groupField = p.fields.find(f =>
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
    */
  }

  onDrop(event: { item: any, from: string, to: string, oldIndex: number, newIndex: number }) {
    const itemId = event.item.getAttribute('data-id');
    if (!itemId) return;

    const isWrapperItem = itemId.startsWith('wrap-');
    let movedItem: AnmeldungenViewModel | undefined;

    // =========================================================================
    // HELPER RECURSIVE FUNCTIONS FOR DEEP STATE MUTATION & SEARCH
    // =========================================================================

    // Recursively finds and extracts a participant or wrapper from a list of view models
    const extractFromTree = (items: AnmeldungenViewModel[], targetContainerId: string, searchId: string | number): AnmeldungenViewModel[] => {
      return items.reduce((acc, item) => {
        if (!this.isParticipant(item)) {
          if (item.id === targetContainerId) {
            // Found the target wrapper container! Grab the item being moved
            const targetIdNum = typeof searchId === 'string' ? null : searchId;
            const found = item.participants.find(p => p.id === targetIdNum || p.id === searchId);
            if (found) movedItem = found;

            // Filter it out from this wrapper's array
            item.participants = item.participants.filter(p => p.id !== targetIdNum && p.id !== searchId);
          } else {
            // Recurse deeper into inner wrappers
            item.participants = extractFromTree(item.participants, targetContainerId, searchId);
          }
        }
        acc.push(item);
        return acc;
      }, [] as AnmeldungenViewModel[]);
    };

    // Recursively finds a target wrapper and splices an item into it
    const insertIntoTree = (items: AnmeldungenViewModel[], targetContainerId: string, itemToInsert: AnmeldungenViewModel, index: number): AnmeldungenViewModel[] => {
      return items.map(item => {
        if (!this.isParticipant(item)) {
          if (item.id === targetContainerId) {
            // Found the target container wrapper, insert the moved item here
            const updatedParticipants = [...item.participants];
            updatedParticipants.splice(index, 0, itemToInsert);
            item.participants = updatedParticipants;
          } else {
            // Keep searching nested wrappers recursively
            item.participants = insertIntoTree(item.participants, targetContainerId, itemToInsert, index);
          }
        }
        return item;
      });
    };

    // =========================================================================
    // 1. EXTRACT THE MOVED ITEM FROM ITS SOURCE
    // =========================================================================
    if (event.from === 'main') {
      const personId = Number(itemId);
      movedItem = this.$anmeldungen().find(p => p.id === personId);
      this.$anmeldungen.update(list => list.filter(p => p.id !== personId));
    }
    else if (event.from === 'wrappers') {
      if (isWrapperItem) {
        movedItem = this.availableWrappers().find(w => w.id === itemId);
        this.availableWrappers.update(list => list.filter(w => w.id !== itemId));
      } else {
        const personId = Number(itemId);
        this.availableWrappers.update(ws => {
          return ws.map(w => {
            if (w.id === itemId) return w;
            const fakeContainer = { id: 'temp-tray-root', participants: [w] };
            extractFromTree([fakeContainer], w.id, personId);
            return fakeContainer.participants[0] as GroupWrapper;
          });
        });
      }
    }
    else if (event.from.startsWith('wrap-')) {
      const targetId = isWrapperItem ? itemId : Number(itemId);

      let wrapperOnTray = this.availableWrappers().find(w => w.id === event.from);
      if (wrapperOnTray) {
        this.availableWrappers.update(ws => {
          const fakeRoot = { id: 'temp-tray-root', participants: ws };
          // FIX: explicitly cast the returned collection as GroupWrapper[]
          fakeRoot.participants = extractFromTree(fakeRoot.participants, event.from, targetId) as GroupWrapper[];
          return fakeRoot.participants;
        });
      } else {
        this.groups.update(gs => gs.map(group => extractFromTree(group, event.from, targetId)));
      }
    }
    else {
      const idNum = Number(itemId);
      const fromGroupIdx = Number(event.from);

      if (!isNaN(fromGroupIdx)) {
        movedItem = this.groups()[fromGroupIdx].find(p => p.id === idNum || p.id === itemId);
        this.groups.update(gs => {
          const newGs = [...gs];
          newGs[fromGroupIdx] = newGs[fromGroupIdx].filter(p => p.id !== idNum && p.id !== itemId);
          return newGs;
        });
      }
    }

    if (!movedItem) return;

    // =========================================================================
    // 2. GENERATE NEW WRAPPER PLACEHOLDER IF EXTRACTED FROM TRAY CONTAINER
    // =========================================================================
    if (event.from === 'wrappers') {
      this.availableWrappers.update(ws => {
        const hasEmptyWrapper = ws.some(w => w.participants.length === 0);
        if (hasEmptyWrapper) return ws;
        return [...ws, { id: `wrap-${Date.now()}`, participants: [] }];
      });
    }

    // =========================================================================
    // 3. INSERT THE MOVED ITEM INTO ITS TARGET DESTINATION
    // =========================================================================
    if (event.to === 'main') {
      this.$anmeldungen.update(list => {
        const newList = [...list];
        newList.splice(event.newIndex, 0, movedItem!);
        return newList;
      });
    }
    else if (event.to === 'wrappers') {
      this.availableWrappers.update(list => {
        const newList = [...list];
        newList.splice(event.newIndex, 0, movedItem as GroupWrapper);
        return newList;
      });
    }
    else if (event.to.startsWith('wrap-')) {
      let targetWrapperOnTray = this.availableWrappers().find(w => w.id === event.to);

      if (targetWrapperOnTray) {
        this.availableWrappers.update(ws => {
          const fakeRoot = { id: 'temp-tray-root', participants: ws };
          // FIX: explicitly cast the returned collection as GroupWrapper[]
          fakeRoot.participants = insertIntoTree(fakeRoot.participants, event.to, movedItem!, event.newIndex) as GroupWrapper[];
          return fakeRoot.participants;
        });
      } else {
        this.groups.update(gs => gs.map(group => insertIntoTree(group, event.to, movedItem!, event.newIndex)));
      }
    }
    else {
      const toGroupIdx = Number(event.to);
      if (!isNaN(toGroupIdx)) {
        this.groups.update(gs => {
          const newGs = [...gs];
          const targetGroup = [...newGs[toGroupIdx]];
          targetGroup.splice(event.newIndex, 0, movedItem!);
          newGs[toGroupIdx] = targetGroup;
          return newGs;
        });
      }
    }
  }

  expandParticipants(items: AnmeldungenViewModel[]): GroupMember[] {
    let flatList: GroupMember[] = [];
    items.forEach(item => {
      if ('participants' in item && Array.isArray(item.participants)) {
        flatList = [...flatList, ...this.expandParticipants(item.participants)];
      } else {
        flatList.push(item as GroupMember);
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
  
  if (!query) {
    return allElements;
  }

  // Helper function to recursively filter a list of view models
  const filterTree = (items: AnmeldungenViewModel[]): AnmeldungenViewModel[] => {
    return items
      .map(item => {
        if (this.isParticipant(item)) {
          // Check if individual participant matches the query
          const matches =
            item.person.domainAttributes.firstName.toLowerCase().includes(query) ||
            item.person.domainAttributes.lastName.toLowerCase().includes(query) ||
            item.id.toString().includes(query);
          
          return matches ? item : null;
        } else {
          const filteredChildren = filterTree(item.participants);
          
          if (filteredChildren.length > 0) {
            return item;
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
}