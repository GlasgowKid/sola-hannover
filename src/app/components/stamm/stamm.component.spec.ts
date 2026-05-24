import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { StammComponent } from './stamm.component';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';
import { GroupMember } from '../../../utils/ct-types';

describe('StammComponent', () => {
  let spectator: Spectator<StammComponent>;

  const createComponent = createComponentFactory({
    component: StammComponent,
    shallow: true,
    imports: [ParticipantCardComponent]
  });

  const mockParticipant = { id: 1, person: { domainAttributes: { firstName: 'M', lastName: 'M' } } } as GroupMember;
  const mockWrapper = { id: 'wrapper-1', isWrapper: true, participants: [{ id: 2, person: { domainAttributes: { firstName: 'X', lastName: 'Y' } } }] };

  beforeEach(() => {
    spectator = createComponent({
      props: {
        stammIdx: 0,
        group: [mockParticipant, mockWrapper as any]
      }
    });
  });

  it('sollte die korrekten Statistiken im Header berechnen und rendern', () => {
    const currentYear = new Date().getFullYear();
    const mockP1 = { id: 1, personFields: { sexId: 1, birthday: `${currentYear - 10}-01-01` }, person: { domainAttributes: { firstName: 'A' } } } as any;
    const mockP2 = { id: 2, personFields: { sexId: 2, birthday: `${currentYear - 14}-01-01` }, person: { domainAttributes: { firstName: 'B' } } } as any;
    spectator.setInput('group', [mockP1, mockP2]);

    expect(spectator.query('.text-primary')).toHaveText('1');
    expect(spectator.query('.text-danger')).toHaveText('1');
    expect(spectator.query('.p-1.text-muted')).toHaveText('Ø Alter: 12 | Varianz: 4');
    expect(spectator.query('.card-header .text-truncate')).toHaveText('Stamm 1');
  });

  it('sollte Helper-Methoden isGroupWrapper und getItemId korrekt ausführen', () => {
    expect(spectator.component.isGroupWrapper(mockParticipant)).toBeFalsy();
    expect(spectator.component.isGroupWrapper(mockWrapper)).toBe(true);

    expect(spectator.component.getItemId(mockParticipant)).toBe(1);
    expect(spectator.component.getItemId(mockWrapper as any)).toBe('wrapper-1');
  });

  it('sollte drag-over Klasse korrekt setzen', () => {
    expect(spectator.query('.group-body')).not.toHaveClass('drag-over');
    spectator.setInput('dragOverZone', 'stamm-0');
    expect(spectator.query('.group-body')).toHaveClass('drag-over');
  });

  it('sollte Group-Wrapper-Cards rendern und dragstart für Gruppen emitten', () => {
    let emittedPayload: any;
    spectator.component.dragStartItem.subscribe(p => (emittedPayload = p));

    spectator.dispatchFakeEvent('.group-wrapper-card', 'dragstart');
    expect(emittedPayload.payload.type).toBe('GROUP');
    expect(emittedPayload.payload.sourceZone).toBe('stamm-0');
  });

  it('sollte resetItem-Event der Kindkarten weiterleiten', () => {
    let emittedMember: GroupMember | undefined;
    spectator.component.resetItem.subscribe(m => (emittedMember = m));

    spectator.triggerEventHandler(ParticipantCardComponent, 'resetNode', undefined);
    expect(emittedMember).toEqual(mockParticipant);
  });

  it('sollte drag-Events des Containers weitergeben', () => {
    let dropEmitted = false;
    spectator.component.dropNode.subscribe(() => (dropEmitted = true));

    spectator.dispatchFakeEvent('.group-body', 'drop');
    expect(dropEmitted).toBe(true);
  });
});