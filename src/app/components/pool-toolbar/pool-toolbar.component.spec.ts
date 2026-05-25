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

  it('sollte Pool Details (Ø Alter, Varianz, Geschlechter) anzeigen, wenn details true ist', () => {
    spectator.setInput('pools', [
      { id: 'pool-0', isWrapper: true, participants: [
        { person: { domainAttributes: { firstName: 'M', lastName: 'J' } }, personFields: { sexId: 1, birthday: '2010-01-01' } },
        { person: { domainAttributes: { firstName: 'A', lastName: 'M' } }, personFields: { sexId: 2, birthday: '2012-01-01' } }
      ]} as any
    ]);
    spectator.setInput('details', false);
    expect(spectator.query('.text-primary')).not.toExist();

    spectator.setInput('details', true);
    expect(spectator.query('.text-primary')).toHaveText('1'); // 1 Junge
    expect(spectator.query('.text-danger')).toHaveText('1'); // 1 Mädchen
    expect(spectator.query('.p-1.bg-light.border-bottom.text-center')).toHaveText('Ø:');
    expect(spectator.query('.p-1.bg-light.border-bottom.text-center')).toHaveText('Var:');
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