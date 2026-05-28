import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { GroupMember } from '../../../utils/ct-types';
import { GroupWrapperCardComponent } from '../group-wrapper-card/group-wrapper-card.component';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';
import { StammComponent } from './stamm.component';

describe('StammComponent', () => {
  let spectator: Spectator<StammComponent>;

  const createComponent = createComponentFactory({
    component: StammComponent,
    shallow: true,
    imports: [ParticipantCardComponent, GroupWrapperCardComponent]
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

  it('sollte Group-Wrapper-Cards rendern und dragstart weiterleiten', () => {
    let emittedPayload: any;
    spectator.component.dragStartItem.subscribe(p => (emittedPayload = p));

    spectator.triggerEventHandler(GroupWrapperCardComponent, 'dragStartItem', { event: new Event('dragstart') as DragEvent, payload: { type: 'GROUP', sourceZone: 'stamm-0', data: mockWrapper } });
    expect(emittedPayload.payload.type).toBe('GROUP');
    expect(emittedPayload.payload.sourceZone).toBe('stamm-0');
  });

  it('sollte dragstart für den gesamten Stamm (Header) emitten, wenn nicht leer', () => {
    let emittedPayload: any;
    spectator.component.dragStartItem.subscribe(p => (emittedPayload = p));

    const header = spectator.query('.card-header');
    expect(header).toHaveClass('cursor-grab');
    spectator.dispatchFakeEvent(header as Element, 'dragstart');
    expect(emittedPayload.payload.type).toBe('STAMM');
    expect(emittedPayload.payload.sourceZone).toBe('stamm-0');
    expect(emittedPayload.payload.data).toEqual(spectator.component.group());
  });

  it('sollte den Header nicht draggable machen, wenn der Stamm leer ist', () => {
    spectator.setInput('group', []);
    const header = spectator.query('.card-header');
    expect(header).not.toHaveClass('cursor-grab');
    expect(header?.getAttribute('draggable')).toBeNull();
  });

  it('sollte dblClickItem emitten, wenn auf den Header des Stammes doppelt geklickt wird', () => {
    let emittedPayload: any;
    spectator.component.dblClickItem.subscribe(p => (emittedPayload = p));

    const header = spectator.query('.card-header') as HTMLElement;
    header.dispatchEvent(new MouseEvent('dblclick'));

    expect(emittedPayload).toBeDefined();
    expect(emittedPayload.payload.type).toBe('STAMM');
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