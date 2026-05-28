import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { GroupWrapperCardComponent } from '../group-wrapper-card/group-wrapper-card.component';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';
import { PoolToolbarComponent } from './pool-toolbar.component';

describe('PoolToolbarComponent', () => {
  let spectator: Spectator<PoolToolbarComponent>;

  const createComponent = createComponentFactory({
    component: PoolToolbarComponent,
    shallow: true,
    imports: [ParticipantCardComponent, GroupWrapperCardComponent]
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

    spectator.triggerEventHandler(GroupWrapperCardComponent, 'dropNode', new Event('drop') as DragEvent);
    expect(dropEmitted.zone).toBe('pool-0');

    spectator.triggerEventHandler(GroupWrapperCardComponent, 'dragStartItem', { event: new Event('dragstart') as DragEvent, payload: { type: 'POOL', sourceZone: 'pool-0', data: [] } });
    expect(dragStartEmitted.payload.type).toBe('POOL');
  });

  it('sollte dblClickItem emitten, wenn auf den Header eines Pools doppelt geklickt wird', () => {
    let emittedPayload: any;
    spectator.component.dblClickItem.subscribe(p => (emittedPayload = p));

    spectator.triggerEventHandler(GroupWrapperCardComponent, 'dblClickItem', { event: new MouseEvent('dblclick'), payload: { type: 'POOL', sourceZone: 'pool-0', data: [] } });

    expect(emittedPayload).toBeDefined();
    expect(emittedPayload.payload.type).toBe('POOL');
    expect(emittedPayload.payload.sourceZone).toBe('pool-0');
  });

  it('sollte z-index und CSS Klasse anpassen, wenn isDragging true ist', () => {
    spectator.setInput('isDragging', true);
    expect(spectator.query('.navbar')).toHaveClass('is-dragging-nav');
  });

  it('sollte den Offset der Scrollbar bei der Toolbar-Positionierung berücksichtigen', () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });

    spectator.setInput('isDragging', true);
    spectator.detectChanges();

    const nav = spectator.query('.navbar') as HTMLElement;
    expect(spectator.component.dragTop()).toBe(905); // 800 - 95 + 200
    expect(nav.style.top).toBe('905px');

    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true });
    window.dispatchEvent(new Event('scroll'));
    spectator.detectChanges();

    expect(spectator.component.dragTop()).toBe(1005); // 800 - 95 + 300
    expect(nav.style.top).toBe('1005px');
  });
});