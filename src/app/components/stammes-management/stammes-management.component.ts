import { CurrencyPipe, DatePipe, PercentPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { addYears, differenceInYears, interval, isAfter, isValid, isWithinInterval, parseISO, startOfYear } from 'date-fns';
import { debounceTime, distinctUntilChanged, filter, firstValueFrom, map, switchMap, tap } from 'rxjs';
import { MemberStatus } from '../../../utils/ct-enums';
import { GroupMember, GroupMemberFieldGroup } from '../../../utils/ct-types';
import { ChurchtoolsService } from '../../services/churchtools.service';
import { SortableDirective } from '../../directives/sortable.directive';

interface GroupWrapper {
  id: string;
  participants: AnmeldungenViewModel[];
}

type AnmeldungenViewModel = GroupMember & {};

@Component({
  selector: 'app-anmeldungen',
  standalone: true,
  imports: [ ReactiveFormsModule, NgxDatatableModule, SortableDirective],
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

  view = signal<'participants' | 'groups'>('participants');
  groups = signal<AnmeldungenViewModel[][]>(Array.from({ length: 8 }, () => []));
  toggleView() {
    this.view.update(v => v === 'participants' ? 'groups' : 'participants');
  }

  availableWrappers = signal<GroupWrapper[]>([{ id: 'wrap-1', participants: [] }]);


  showIds = signal<boolean>(false);
  toggleIds() {
    this.showIds.update(v => !v);
  }

  showAge = signal<boolean>(false);
  toggleAge() {
    this.showAge.update(v => !v);
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

  getGenderClass(p: AnmeldungenViewModel): string {
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
  }
  async saveGroupsServerSlow() {
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
  }

  loadGroups() {
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
  }

  loadGroupsServer() {
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
  }

  onDrop(event: { item: any, from: string, to: string, oldIndex: number, newIndex: number }) {
    const itemId = event.item.getAttribute('data-id');
    const isWrapper = itemId.startsWith('wrap-');
    if (!isWrapper) {
      const personId = Number(itemId);
      let movedParticipant: AnmeldungenViewModel | undefined;
      if (event.from === 'main') {
        movedParticipant = this.$anmeldungen().find(p => p.id === personId);
        this.$anmeldungen.update(list => list.filter(p => p.id !== personId));
      } else if (event.from.startsWith('wrap-')) {
        this.availableWrappers.update(ws => ws.map(w => {
          if (w.id === event.from) {
            movedParticipant = w.participants.find(p => p.id === personId);
            w.participants = w.participants.filter(p => p.id !== personId);
          }
          return w;
        }));
      } else {
        const fromIdx = Number(event.from);
        movedParticipant = this.groups()[fromIdx].find(p => p.id === personId);
        this.groups.update(gs => {
          const newGs = [...gs];
          newGs[fromIdx] = newGs[fromIdx].filter(p => p.id !== personId);
          return newGs;
        });
      }

      if (!movedParticipant) return;
      if (event.to === 'main') {
        this.$anmeldungen.update(list => {
          const newList = [...list];
          newList.splice(event.newIndex, 0, movedParticipant!);
          return newList;
        });
      } else if (event.to.startsWith('wrap-')) {
        this.availableWrappers.update(ws => ws.map(w => {
          if (w.id === event.to) {
            w.participants.splice(event.newIndex, 0, movedParticipant!);
          }
          return w;
        }));
      } else {
        const toIdx = Number(event.to);
        this.groups.update(gs => {
          const newGs = [...gs];
          const targetGroup = [...newGs[toIdx]];
          targetGroup.splice(event.newIndex, 0, movedParticipant!);
          newGs[toIdx] = targetGroup;
          return newGs;
        });
      }
    }
    else if (isWrapper && event.to !== 'wrappers') {
      this.availableWrappers.update(ws => {
        const newId = `wrap-${Date.now()}`;
        return [...ws, { id: newId, participants: [] }];
      });
    }
  }


  getGenderCounts(group: AnmeldungenViewModel[]) {
    const participants = this.flattenGroup(group);
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
    const participants = this.flattenGroup(group);
    if (participants.length === 0) return 0;

    const totalAge = participants.reduce((sum, member) => {
      const age = this.getAgeThisYear(member.personFields?.birthday);
      return sum + (age || 0);
    }, 0);

    return Math.round((totalAge / participants.length) * 10) / 10; // Added 1 decimal for better precision
  }

  getAgeVariance(group: AnmeldungenViewModel[]): number {
    const participants = this.flattenGroup(group);
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

  private flattenGroup(items: any[]): AnmeldungenViewModel[] {
    let flat: AnmeldungenViewModel[] = [];
    items.forEach(item => {
      if (item.participants) {
        flat = [...flat, ...item.participants];
      } else {
        flat.push(item);
      }
    });
    return flat;
  }


  searchTerm = signal<string>('');

  filteredParticipants = computed(() => {
    const query = this.searchTerm().toLowerCase();
    const all = this.$anmeldungen();
    if (!query) return all;
    return all.filter(p =>
      p.person.domainAttributes.firstName.toLowerCase().includes(query) ||
      p.person.domainAttributes.lastName.toLowerCase().includes(query) ||
      p.id.toString().includes(query)
    );
  });

  updateSearch(event: Event) {
    const element = event.target as HTMLInputElement;
    this.searchTerm.set(element.value);
  }

  private getAllParticipantsInGroup(group: AnmeldungenViewModel[]): AnmeldungenViewModel[] {
    return group;
  }
}