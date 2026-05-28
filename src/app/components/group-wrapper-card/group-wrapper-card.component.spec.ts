import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';
import { GroupWrapperCardComponent } from './group-wrapper-card.component';

describe('GroupWrapperCardComponent', () => {
  let spectator: Spectator<GroupWrapperCardComponent>;

  const createComponent = createComponentFactory({
    component: GroupWrapperCardComponent,
    shallow: true,
    imports: [ParticipantCardComponent]
  });

  beforeEach(() => {
    spectator = createComponent({
      props: {
        group: {
          id: 'wrapper-1',
          isWrapper: true,
          name: 'Test Group',
          participants: [
            { id: 1, person: { domainAttributes: { firstName: 'M', lastName: 'J' } }, personFields: { sexId: 1, birthday: '2010-01-01' } },
            { id: 2, person: { domainAttributes: { firstName: 'A', lastName: 'M' } }, personFields: { sexId: 2, birthday: '2012-01-01' } }
          ]
        } as any,
        sourceZone: 'zone-1'
      }
    });
  });

  it('sollte erstellt werden', () => {
    expect(spectator.component).toBeTruthy();
    expect(spectator.query('.fw-bold')).toHaveText('Test Group');
  });

  it('sollte dragStartItem emitten, wenn die Karte gedragged wird', () => {
    let emitted: any;
    spectator.component.dragStartItem.subscribe(e => (emitted = e));

    spectator.dispatchFakeEvent('.group-wrapper-card', 'dragstart');

    expect(emitted.payload.type).toBe('GROUP');
    expect(emitted.payload.sourceZone).toBe('zone-1');
  });

  it('sollte dblClickItem emitten, wenn auf die Karte doppelt geklickt wird', () => {
    let emitted: any;
    spectator.component.dblClickItem.subscribe(e => (emitted = e));

    const card = spectator.query('.group-wrapper-card') as HTMLElement;
    card.dispatchEvent(new MouseEvent('dblclick'));

    expect(emitted.payload.type).toBe('GROUP');
    expect(emitted.payload.sourceZone).toBe('zone-1');
  });

  it('sollte dragOver Klasse setzen, wenn isDropZone true ist und dragOverZone passt', () => {
    spectator.setInput('isDropZone', true);
    spectator.setInput('dragOverZone', 'zone-1');
    expect(spectator.query('.wrapper-body')).toHaveClass('drag-over');
  });

  it('sollte Pool Details (Ø Alter, Varianz, Geschlechter) anzeigen, wenn showPoolStats und details true sind', () => {
    spectator.setInput('details', true);
    spectator.setInput('showPoolStats', true);

    expect(spectator.query('.text-primary')).toHaveText('1'); // 1 Junge
    expect(spectator.query('.text-danger')).toHaveText('1'); // 1 Mädchen
    expect(spectator.query('.p-1.bg-light.border-bottom.text-center')).toHaveText('Ø:');
    expect(spectator.query('.p-1.bg-light.border-bottom.text-center')).toHaveText('Var:');
  });

  it('sollte drop-Events emitten, wenn isDropZone true ist', () => {
    spectator.setInput('isDropZone', true);
    let dropEmitted: any;
    spectator.component.dropNode.subscribe(e => (dropEmitted = e));

    spectator.dispatchFakeEvent('.wrapper-body', 'drop');
    expect(dropEmitted).toBeTruthy();
  });
});