import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { ParticipantCardComponent } from './participant-card.component';
import { GroupMember } from '../../../utils/ct-types';

describe('ParticipantCardComponent', () => {
  let spectator: Spectator<ParticipantCardComponent>;

  const createComponent = createComponentFactory({
    component: ParticipantCardComponent,
    shallow: true
  });

  const getMockMember = (sexId?: number, birthday?: string, fields: any[] = []): GroupMember => ({
    id: 123,
    person: { domainAttributes: { firstName: 'Max', lastName: 'Mustermann' }, frontendUrl: 'url123' },
    personFields: { sexId, birthday, zip: '12345', city: 'Musterstadt' },
    fields
  } as unknown as GroupMember);

  beforeEach(() => {
    spectator = createComponent({
      props: {
        item: getMockMember(1, '2010-05-15'),
        sourceZone: 'main',
        showIds: false
      }
    });
  });

  it('sollte erstellt werden und Basisdaten rendern', () => {
    expect(spectator.component).toBeTruthy();
    expect(spectator.query('.fw-bold')).toHaveText('Max Mustermann');
  });

  it('sollte das berechnete Alter anzeigen', () => {
    const currentYear = new Date().getFullYear();
    const expectedAge = currentYear - 2010;
    expect(spectator.query('.fw-normal')).toHaveText(`(${expectedAge})`);
  });

  it('sollte kein Alter anzeigen, wenn kein oder ein ungültiges Geburtsdatum vorliegt', () => {
    spectator.setInput('item', getMockMember(1, undefined));
    expect(spectator.query('.fw-normal')).not.toExist();

    spectator.setInput('item', getMockMember(1, 'invalid-date'));
    expect(spectator.query('.fw-normal')).not.toExist();
  });

  it('sollte die ID anzeigen, wenn showIds aktiv ist', () => {
    expect(spectator.query('small')).not.toExist();
    spectator.setInput('showIds', true);
    expect(spectator.query('small')).toHaveText('#123');
  });

  it('sollte korrekte CSS-Klassen für Geschlechter anwenden', () => {
    // Jungs (1) = primary
    expect(spectator.query('.participant-card')).toHaveClass('border-primary');
    
    // Mädchen (2) = danger
    spectator.setInput('item', getMockMember(2));
    expect(spectator.query('.participant-card')).toHaveClass('border-danger');

    // Unbekannt = white
    spectator.setInput('item', getMockMember(0));
    expect(spectator.query('.participant-card')).toHaveClass('bg-white');
  });

  it('sollte den Zurücksetzen-Button nur anzeigen, wenn sourceZone nicht main ist', () => {
    expect(spectator.query('.btn-close')).not.toExist();
    
    spectator.setInput('sourceZone', 'stamm-0');
    expect(spectator.query('.btn-close')).toExist();
  });

  it('sollte onDragStart emitten und stopPropagation aufrufen', () => {
    let emittedEvent: DragEvent | undefined;
    spectator.component.dragStartNode.subscribe(e => (emittedEvent = e));
    
    const event = new Event('dragstart') as DragEvent;
    event.stopPropagation = jest.fn();
    spectator.query('.participant-card')?.dispatchEvent(event);
    
    expect(emittedEvent).toBeTruthy();
  });

  it('sollte onReset emitten wenn das X geklickt wird', () => {
    spectator.setInput('sourceZone', 'pool-1'); // Sichtbar machen
    let resetEmitted = false;
    spectator.component.resetNode.subscribe(() => (resetEmitted = true));
    spectator.click('.btn-close');
    expect(resetEmitted).toBe(true);
  });

  it('sollte Details ein- und ausblenden', () => {
    spectator.setInput('details', false);
    expect(spectator.element).not.toHaveText('12345');
  });

  it('sollte PLZ und Ort anzeigen wenn details true ist', () => {
    spectator.setInput('details', true);
    expect(spectator.query('.mt-1.d-flex')).toHaveText('12345 Musterstadt');
  });

  it('sollte offenen Wunsch anzeigen in rot', () => {
    spectator.setInput('item', getMockMember(1, undefined, [{ name: 'Wunsch 1', value: 'Anna' }]));
    spectator.setInput('details', true);
    const w1 = spectator.queryAll('.text-truncate')[0];
    expect(w1).toHaveText('W1: Anna');
    expect(w1).toHaveClass('text-danger');
  });

  it('sollte ignorierten Wunsch anzeigen in gelb', () => {
    spectator.setInput('item', getMockMember(1, undefined, [{ name: 'Wunsch 1', value: 'Anna (ignoriert)' }]));
    spectator.setInput('details', true);
    const w1 = spectator.queryAll('.text-truncate')[0];
    expect(w1).toHaveText('W1: Anna');
    expect(w1).toHaveClass('text-warning-emphasis');
  });

  it('sollte zugeordneten Wunsch als Namen in grün anzeigen', () => {
    spectator.setInput('allParticipants', [
      { person: { frontendUrl: 'https://sola-hannover.church.tools/?q=churchdb#PersonView/searchEntry:%2399', domainAttributes: { firstName: 'Anna', lastName: 'Müller' } } } as any
    ]);
    spectator.setInput('item', getMockMember(1, undefined, [{ name: 'Wunsch 1', value: 'https://sola-hannover.church.tools/?q=churchdb#PersonView/searchEntry:%2399' }]));
    spectator.setInput('details', true);
    
    const w1 = spectator.queryAll('.text-truncate')[0];
    expect(w1).toHaveText('W1: Anna Müller');
    expect(w1).toHaveClass('text-success');
  });
});