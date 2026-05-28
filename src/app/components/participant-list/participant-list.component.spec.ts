import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { GroupMember } from '../../../utils/ct-types';
import { GroupWrapperCardComponent } from '../group-wrapper-card/group-wrapper-card.component';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';
import { StammItem } from '../stammes-einteilung/stammes-einteilung.component';
import { ParticipantListComponent } from './participant-list.component';

describe('ParticipantListComponent', () => {
  let spectator: Spectator<ParticipantListComponent>;

  const createComponent = createComponentFactory({
    component: ParticipantListComponent,
    shallow: true, // Mockt die ParticipantCardComponent
    imports: [ParticipantCardComponent, GroupWrapperCardComponent, FormsModule]
  });

  const mockParticipants: StammItem[] = [
    { id: 1, person: { domainAttributes: { firstName: 'A', lastName: 'A' } } } as unknown as GroupMember,
    { id: 2, person: { domainAttributes: { firstName: 'B', lastName: 'B' } } } as unknown as GroupMember
  ];

  beforeEach(() => {
    spectator = createComponent({
      props: {
        participants: mockParticipants,
        hasAnmeldungen: true
      }
    });
  });

  it('sollte die Anzahl der Teilnehmer im Header anzeigen', () => {
    expect(spectator.query('.badge')).toHaveText('2');
  });

  it('sollte Filter und Suche verstecken, wenn hasAnmeldungen false ist', () => {
    spectator.setInput('hasAnmeldungen', false);
    expect(spectator.query('.form-select')).not.toExist();
    expect(spectator.query('.form-control')).not.toExist();
  });

  it('sollte leere State-Message zeigen, wenn keine Teilnehmer vorhanden sind', () => {
    spectator.setInput('participants', []);
    expect(spectator.query('.text-muted.mt-3')).toHaveText('Keine Teilnehmer gefunden.');
  });

  it('sollte Events für Filter, Sortierung, Gruppierung und Suche emitten', () => {
    let filterEvent: Event | undefined;
    let sortEvent: string | undefined;
    let groupingEvent: string | undefined;
    let searchEvent: Event | undefined;
    spectator.component.filterChange.subscribe(e => (filterEvent = e));
    spectator.component.sortChange.subscribe(e => (sortEvent = e));
    spectator.component.groupingChange.subscribe(e => (groupingEvent = e));
    spectator.component.searchChange.subscribe(e => (searchEvent = e));

    const selects = spectator.queryAll('select');
    spectator.dispatchFakeEvent(selects[0], 'change');

    const selectsDebug = spectator.debugElement.queryAll(By.css('select'));
    spectator.triggerEventHandler(selectsDebug[1], 'ngModelChange', 'age_asc');
    spectator.triggerEventHandler(selectsDebug[2], 'ngModelChange', 'zip');

    spectator.typeInElement('Max', 'input[type="text"]');

    expect(filterEvent).toBeTruthy();
    expect(sortEvent).toBe('age_asc');
    expect(groupingEvent).toBe('zip');
    expect(searchEvent).toBeTruthy();
  });

  it('sollte Drag- und Drop-Events des Containers weiterleiten', () => {
    let dropEmitted = false;
    spectator.component.dropNode.subscribe(() => (dropEmitted = true));

    spectator.dispatchFakeEvent('.main-pool', 'drop');
    expect(dropEmitted).toBe(true);
  });

  it('sollte die drag-over Klasse basierend auf Input anwenden', () => {
    expect(spectator.query('.main-pool')).not.toHaveClass('drag-over');
    spectator.setInput('dragOverZone', 'main');
    expect(spectator.query('.main-pool')).toHaveClass('drag-over');
  });

  it('sollte dragStartItem weiterleiten, wenn von einer Kind-Karte gesendet', () => {
    let emittedPayload: any;
    spectator.component.dragStartItem.subscribe(p => (emittedPayload = p));

    spectator.triggerEventHandler(ParticipantCardComponent, 'dragStartNode', new Event('dragstart') as DragEvent);
    expect(emittedPayload).toBeDefined();
  });

  it('sollte dblClickItem emitten, wenn auf eine ParticipantCard doppelt geklickt wird', () => {
    let emittedPayload: any;
    spectator.component.dblClickItem.subscribe(p => (emittedPayload = p));

    spectator.triggerEventHandler(ParticipantCardComponent, 'dblClickNode', new MouseEvent('dblclick'));
    expect(emittedPayload).toBeDefined();
    expect(emittedPayload.payload.type).toBe('PARTICIPANT');
    expect(emittedPayload.payload.sourceZone).toBe('main');
  });

  it('sollte dblClickItem emitten, wenn auf den Header einer Gruppe doppelt geklickt wird', () => {
    spectator.setInput('participants', [{ id: 'group1', isWrapper: true, participants: [] } as any]);
    let emittedPayload: any;
    spectator.component.dblClickItem.subscribe(p => (emittedPayload = p));

    spectator.triggerEventHandler(GroupWrapperCardComponent, 'dblClickItem', { event: new MouseEvent('dblclick'), payload: { type: 'GROUP', sourceZone: 'main', data: {} } });

    expect(emittedPayload).toBeDefined();
    expect(emittedPayload.payload.type).toBe('GROUP');
    expect(emittedPayload.payload.sourceZone).toBe('main');
  });

  it('sollte verfügbare Alter als Filteroptionen anzeigen', () => {
    spectator.setInput('availableAges', [10, 11, 12, null]);
    const options = spectator.queryAll('option');
    expect(options.some(opt => opt.textContent?.trim() === '10 Jahre')).toBe(true);
    expect(options.some(opt => opt.textContent?.trim() === '11 Jahre')).toBe(true);
    expect(options.some(opt => opt.textContent?.trim() === '12 Jahre')).toBe(true);
    expect(options.some(opt => opt.textContent?.trim() === 'keine Angabe')).toBe(true);
  });

  it('sollte Sortieroptionen für Gruppen anzeigen, wenn activeGrouping zip ist', () => {
    spectator.setInput('activeGrouping', 'zip');
    const options = spectator.queryAll('option') as HTMLOptionElement[];
    expect(options.some(opt => opt.value.includes('groupSize_asc'))).toBe(true);
    expect(options.some(opt => opt.value.includes('groupSize_desc'))).toBe(true);
    expect(options.some(opt => opt.value.includes('group_asc'))).toBe(true);
    expect(options.some(opt => opt.textContent?.trim() === 'PLZ (aufsteigend)')).toBe(true);
  });

  it('sollte Sortieroptionen für Gruppen anzeigen, wenn activeGrouping city ist', () => {
    spectator.setInput('activeGrouping', 'city');
    const options = spectator.queryAll('option') as HTMLOptionElement[];
    expect(options.some(opt => opt.value.includes('group_asc'))).toBe(true);
    expect(options.some(opt => opt.textContent?.trim() === 'Ort (A bis Z)')).toBe(true);
  });

  it('sollte asc/desc Optionen für Gruppen verstecken, wenn activeGrouping wunsch ist', () => {
    spectator.setInput('activeGrouping', 'wunsch');
    const options = spectator.queryAll('option') as HTMLOptionElement[];
    expect(options.some(opt => opt.value.includes('group_asc'))).toBe(false);
    expect(options.some(opt => opt.value.includes('groupSize_asc'))).toBe(true);
  });

  it('sollte Sortieroptionen für Gruppen verstecken, wenn activeGrouping none ist', () => {
    spectator.setInput('activeGrouping', 'none');
    const options = spectator.queryAll('option') as HTMLOptionElement[];
    expect(options.some(opt => opt.value.includes('groupSize_asc'))).toBe(false);
  });

  it('sollte das Auswahlfeld für die Sortierung im DOM korrekt aktualisieren, wenn sich die aktiven Inputs ändern', async () => {
    // Simulieren des Wechsels auf Gruppierung 'zip' mit der neuen automatischen Sortierung 'group_asc'
    spectator.setInput('activeGrouping', 'zip');
    spectator.setInput('currentSort', 'group_asc');

    // Bei ngModel müssen wir warten, bis die Formularelemente asynchron synchronisiert wurden
    await spectator.fixture.whenStable();

    const sortSelect = spectator.queryAll('select')[1] as HTMLSelectElement;
    expect(sortSelect.value).toContain('group_asc');
  });

  it('sollte bei Wechsel der Gruppierung auf Ort den korrekten Sortierungswert im DOM anzeigen', async () => {
    // 1) Ich stelle das Auswahlfeld "Gruppierung" auf "keine Gruppierung".
    // Das Auswahlfeld "Sortierung" ist auf "Nachname (A bis Z)" eingestellt.
    spectator.setInput('activeGrouping', 'none');
    spectator.setInput('currentSort', 'lastName_asc');
    await spectator.fixture.whenStable();

    let sortSelect = spectator.queryAll('select')[1] as HTMLSelectElement;
    expect(sortSelect.value).toContain('lastName_asc');

    // 2) Ich ändere das Auswahlfeld "Gruppierung" auf "nach Ort gruppiert".
    spectator.setInput('activeGrouping', 'city');
    spectator.setInput('currentSort', 'group_asc');
    await spectator.fixture.whenStable();

    // Erwartetes Verhalten: Das Auswahlfeld "Sortierung" zeigt den korrekten Wert "Ort (A bis Z)"
    sortSelect = spectator.queryAll('select')[1] as HTMLSelectElement;
    expect(sortSelect.value).toContain('group_asc');
    expect(sortSelect.options[sortSelect.selectedIndex].textContent?.trim()).toBe('Ort (A bis Z)');
  });
});