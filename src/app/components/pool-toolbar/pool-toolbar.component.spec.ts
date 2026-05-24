import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { PoolToolbarComponent } from './pool-toolbar.component';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';

describe('PoolToolbarComponent', () => {
  let spectator: Spectator<PoolToolbarComponent>;

  const createComponent = createComponentFactory({
    component: PoolToolbarComponent,
    shallow: true,
    imports: [ParticipantCardComponent]
  });

  beforeEach(() => {
    spectator = createComponent({
      props: {
        pools: [{ id: 'pool-0', isWrapper: true, participants: [] } as any],
        isDirty: false,
        progress: 0,
        isDragging: false
      }
    });
  });

  it('sollte Toggle-Events feuern, wenn Checkboxen geklickt werden', () => {
    let toggleIdsEmitted = false;
    let toggleDetailsEmitted = false;
    spectator.component.toggleIds.subscribe(() => (toggleIdsEmitted = true));
    spectator.component.toggleDetails.subscribe(() => (toggleDetailsEmitted = true));

    spectator.dispatchFakeEvent('#idToggle', 'change');
    spectator.dispatchFakeEvent('#details', 'change');

    expect(toggleIdsEmitted).toBe(true);
    expect(toggleDetailsEmitted).toBe(true);
  });

  it('sollte die Speichern-Buttons richtig sperren oder aktivieren', () => {
    const saveBtn = spectator.query('.btn-primary') as HTMLButtonElement;
    
    // disabled, da isDirty false und progress 0
    expect(saveBtn.disabled).toBe(true);

    // enabled, da isDirty true
    spectator.setInput('isDirty', true);
    expect(saveBtn.disabled).toBe(false);

    // disabled, da progress > 0 (obwohl dirty)
    spectator.setInput('progress', 0.5);
    expect(saveBtn.disabled).toBe(true);
  });

  it('sollte confirmLoad und saveGroups Events feuern', () => {
    spectator.setInput('isDirty', true); // Aktiviert Save Button
    let loadEmitted = false, saveEmitted = false;
    spectator.component.confirmLoadServer.subscribe(() => (loadEmitted = true));
    spectator.component.saveGroupsServer.subscribe(() => (saveEmitted = true));

    spectator.click('.btn-outline-danger');
    spectator.click('.btn-primary');

    expect(loadEmitted).toBe(true);
    expect(saveEmitted).toBe(true);
  });

  it('sollte Drag/Drop Events an den Pool-Wrappern erfassen', () => {
    let dropEmitted: any;
    let dragStartEmitted: any;
    spectator.component.dropNode.subscribe(e => (dropEmitted = e));
    spectator.component.dragStartItem.subscribe(e => (dragStartEmitted = e));

    spectator.dispatchFakeEvent('.wrapper-body', 'drop');
    expect(dropEmitted.zone).toBe('pool-0');

    spectator.dispatchFakeEvent('.group-wrapper-card', 'dragstart');
    expect(dragStartEmitted.payload.type).toBe('POOL');
  });

  it('sollte z-index und CSS Klasse anpassen, wenn isDragging true ist', () => {
    spectator.setInput('isDragging', true);
    expect(spectator.query('.navbar')).toHaveClass('is-dragging-nav');
  });
});