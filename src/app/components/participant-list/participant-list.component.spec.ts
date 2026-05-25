import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { ParticipantListComponent } from './participant-list.component';
import { GroupMember } from '../../../utils/ct-types';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';

describe('ParticipantListComponent', () => {
  let spectator: Spectator<ParticipantListComponent>;

  const createComponent = createComponentFactory({
    component: ParticipantListComponent,
    shallow: true, // Mockt die ParticipantCardComponent
    imports: [ParticipantCardComponent]
  });

  const mockParticipants = [
    { id: 1, person: { domainAttributes: { firstName: 'A', lastName: 'A' } } } as GroupMember,
    { id: 2, person: { domainAttributes: { firstName: 'B', lastName: 'B' } } } as GroupMember
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

  it('sollte Events für Filter, Sortierung und Suche emitten', () => {
    let filterEvent: Event | undefined;
    let sortEvent: Event | undefined;
    let searchEvent: Event | undefined;
    spectator.component.filterChange.subscribe(e => (filterEvent = e));
    spectator.component.sortChange.subscribe(e => (sortEvent = e));
    spectator.component.searchChange.subscribe(e => (searchEvent = e));

    const selects = spectator.queryAll('select');
    spectator.dispatchFakeEvent(selects[0], 'change');
    spectator.dispatchFakeEvent(selects[1], 'change');
    spectator.typeInElement('Max', 'input[type="text"]');

    expect(filterEvent).toBeTruthy();
    expect(sortEvent).toBeTruthy();
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

  it('sollte verfügbare Alter als Filteroptionen anzeigen', () => {
    spectator.setInput('availableAges', [10, 11, 12, null]);
    const options = spectator.queryAll('option');
    expect(options.some(opt => opt.textContent?.trim() === '10 Jahre')).toBe(true);
    expect(options.some(opt => opt.textContent?.trim() === '11 Jahre')).toBe(true);
    expect(options.some(opt => opt.textContent?.trim() === '12 Jahre')).toBe(true);
    expect(options.some(opt => opt.textContent?.trim() === 'keine Angabe')).toBe(true);
  });
});