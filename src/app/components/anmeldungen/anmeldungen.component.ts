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

const PRICES = { CHILD: 80, ADULT: 120, DOG: 20, BASE: 80 };

interface Familienpreis {
  personenAnzahl5Bis12: number;
  personenAnzahlAb13: number;
  anzahlHunde: number;
  invalid: boolean;
  anzahlFamilienmitglieder: number;
  gesamt: number;
}

type AnmeldungenViewModel = GroupMember & { familienpreis: Familienpreis };

@Component({
  selector: 'app-anmeldungen',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, NgxDatatableModule, PercentPipe, SortableDirective],
  templateUrl: './anmeldungen.component.html',
  styleUrl: './anmeldungen.component.scss',
})

export class AnmeldungenComponent {
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


  showIds = signal<boolean>(false);
  toggleIds() {
    this.showIds.update(v => !v);
  }

  showAge = signal<boolean>(false);
  toggleAge() {
    this.showAge.update(v => !v);
  }

  readonly $groupTypes = toSignal(this.churchToolsService.getGroupTypes());
  readonly $jahre = toSignal(this.churchToolsService.getJahre());

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

  private readonly $priceRefDate = computed<Date>(() => {
    const solawoche = this.$solawochen()?.find(s => s.id === this.$selectedWeek());
    const dateStr = solawoche?.information?.dateOfFoundation;
    return dateStr ? parseISO(String(dateStr)) : startOfYear(new Date());
  });

  readonly $isFamiliensola = computed(() =>
    this.$anmeldungen().some(a => a.familienpreis.anzahlFamilienmitglieder > 1)
  );

  constructor() {
    this.anmeldungen$.pipe(takeUntilDestroyed()).subscribe(data => {
      const viewModels = data.map(m => ({ ...m, familienpreis: this.calculateFamilienpreis(m) }));
      this.$anmeldungen.set(viewModels);
      this.$errorIds.set([]);
    });
  }

  private calculateFamilienpreis(anmeldung: GroupMember): Familienpreis {
    const birthdates: Date[] = [];
    let invalid = false;

    const addDate = (val: unknown) => {
      const d = parseISO(String(val));
      if (isValid(d)) birthdates.push(d);
      else invalid = true;
    };

    if (anmeldung.personFields?.birthday) addDate(anmeldung.personFields.birthday);
    else invalid = true;

    let anzahlFamilienmitglieder = 1;
    for (let i = 2; i <= 8; i++) {
      const familienmitglied = anmeldung.fields.filter(({ name }) => name.endsWith(`Familienmitglied ${i}`));
      if (familienmitglied.length) {
        anzahlFamilienmitglieder++;
        const geburtstagFeld = familienmitglied.find(f => f.name.startsWith("Geburtstag"));
        if (geburtstagFeld?.value) addDate(geburtstagFeld?.value);
        else invalid = true;
      }
    }

    let personenAnzahl5Bis12 = 0;
    let personenAnzahlAb13 = 0;
    const refDate = this.$priceRefDate();
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
    return { personenAnzahl5Bis12, personenAnzahlAb13, anzahlHunde, gesamt, anzahlFamilienmitglieder, invalid };
  }

  private performSingleUpdate(groupId: number, anmeldung: AnmeldungenViewModel, fieldDef: GroupMemberFieldGroup): Promise<GroupMember> {
    const value = anmeldung.familienpreis.gesamt;
    const { id, name, sortKey } = fieldDef;
    const fields = [...anmeldung.fields, { id, name, value, sortKey }];
    const groupMemberStatus = MemberStatus.ACTIVE;

    return firstValueFrom(
      this.churchToolsService.updateGroupMember(groupId, anmeldung.personId, { fields, groupMemberStatus })
    );
  }

  async updateFamilienpreis() {
    const groupId = this.formGroup.value.selectedWeek;
    if (!groupId || this.$progress() > 0) return;

    try {
      const fields = await firstValueFrom(this.churchToolsService.getGroupMemberFields(groupId));
      const familienpreisField = fields?.find(f => f.referenceName === "familienpreis");

      const toUpdate = this.$anmeldungen().filter(m => m.groupMemberStatus === MemberStatus.REQUESTED);
      if (!familienpreisField || toUpdate.length === 0) return;

      this.$progress.set(0.01);

      for (const [index, anmeldung] of toUpdate.entries()) {
        try {
          const updatedMember = await this.performSingleUpdate(groupId, anmeldung, familienpreisField);
          const { fields, personFields, familienpreis } = anmeldung;
          const merged = { ...updatedMember, fields, personFields, familienpreis };
          this.$anmeldungen.update(list => list.map(m => m.id === merged.id ? merged : m));

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

  sortableOptions = {
    group: 'nested',
    animation: 150,
    fallbackOnBody: true,
    swapThreshold: 0.65
  };

  moveParticipant(movedItem: AnmeldungenViewModel, targetList: 'main' | number) {
    // Remove from everywhere first
    this.$anmeldungen.update(list => list.filter(p => p.id !== movedItem.id));
    this.groups.update(groups => groups.map(g => g.filter(p => p.id !== movedItem.id)));

    // Add to target
    if (targetList === 'main') {
      this.$anmeldungen.update(list => [...list, movedItem]);
    } else {
      this.groups.update(groups => {
        const newGroups = [...groups];
        newGroups[targetList] = [...newGroups[targetList], movedItem];
        return newGroups;
      });
    }
  }

  getGenderClass(p: AnmeldungenViewModel): string {
    const sexId = p.personFields?.sexId;
    if (sexId === 1) return 'border-primary border-3 bg-blue-light'; // Boy (Blue)
    if (sexId === 2) return 'border-danger border-3 bg-red-light';   // Girl (Red)
    return 'bg-white';
  }

  private get storageKey(): string {
    return `groups_assignment_${this.formGroup.value.selectedWeek}`;
  }

  // 2. The handler for the Sortable Directive's onDrop event
  saveGroups() {
    const weekId = this.formGroup.value.selectedWeek;
    if (!weekId) return;

    // We only store the IDs of the persons in each group to keep the storage clean
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
    const personId = Number(event.item.getAttribute('data-id'));
    let movedItem: AnmeldungenViewModel | undefined;

    if (event.from === 'main') {
      movedItem = this.$anmeldungen().find(p => p.id === personId);
    } else {
      movedItem = this.groups()[Number(event.from)].find(p => p.id === personId);
    }
    if (!movedItem) return;
    if (event.from === 'main') {
      this.$anmeldungen.update(list => list.filter(p => p.id !== personId));
    } else {
      this.groups.update(gs => {
        gs[Number(event.from)] = gs[Number(event.from)].filter(p => p.id !== personId);
        return [...gs];
      });
    }
    if (event.to === 'main') {
      this.$anmeldungen.update(list => [...list, movedItem!]);
    } else {
      this.groups.update(gs => {
        gs[Number(event.to)].push(movedItem!);
        return [...gs];
      });
    }
  }


  getGenderCounts(group: AnmeldungenViewModel[]) {
    return {
      boys: group.filter(p => p.personFields?.sexId === 1).length,
      girls: group.filter(p => p.personFields?.sexId === 2).length
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
    if (group.length === 0) return 0;

    const totalAge = group.reduce((sum, member) => {
      const age = this.getAgeThisYear(member.personFields?.birthday);
      return sum + (age || 0);
    }, 0);

    return Math.round(totalAge / group.length);
  }


  searchTerm = signal<string>('');

  filteredParticipants = computed(() => {
    const query = this.searchTerm().toLowerCase();
    const all = this.$anmeldungen(); // This is your original list signal

    if (!query) return all;

    return all.filter(p =>
      p.person.domainAttributes.firstName.toLowerCase().includes(query) ||
      p.person.domainAttributes.lastName.toLowerCase().includes(query) ||
      p.id.toString().includes(query)
    );
  });

  // 3. Helper method to update the signal from the template
  updateSearch(event: Event) {
    const element = event.target as HTMLInputElement;
    this.searchTerm.set(element.value);
  }
}