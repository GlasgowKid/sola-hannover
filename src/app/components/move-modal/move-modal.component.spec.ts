import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { MoveModalComponent } from './move-modal.component';

describe('MoveModalComponent', () => {
  let spectator: Spectator<MoveModalComponent>;
  let modalRefMock: any;

  const createComponent = createComponentFactory({
    component: MoveModalComponent,
    detectChanges: false,
    providers: [
      { provide: BsModalRef, useValue: {} }
    ]
  });

  beforeEach(() => {
    modalRefMock = { hide: jest.fn() };
    spectator = createComponent({
      providers: [
        { provide: BsModalRef, useValue: modalRefMock }
      ]
    });

    spectator.component.payload = { type: 'PARTICIPANT', sourceZone: 'main', data: {} } as any;
    spectator.component.extractedParticipants = [{ id: 1, person: { domainAttributes: { firstName: 'Max', lastName: 'Muster' } } }] as any;
    spectator.component.staemmeCount = 8;
    spectator.component.pools = [{ id: 'pool-0', isWrapper: true, participants: [] }] as any;

    spectator.detectChanges();
  });

  it('sollte erstellt werden', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('sollte onClose mit target aufrufen und das Modal schließen bei confirmMove()', () => {
    let result: string | null | undefined;
    spectator.component.onClose.subscribe(res => (result = res));

    spectator.component.moveModalTarget.set('stamm-2');
    spectator.component.confirmMove();

    expect(result).toBe('stamm-2');
    expect(modalRefMock.hide).toHaveBeenCalled();
  });

  it('sollte onClose mit null aufrufen und das Modal schließen bei cancel()', () => {
    let result: string | null | undefined;
    spectator.component.onClose.subscribe(res => (result = res));

    spectator.component.cancel();

    expect(result).toBeNull();
    expect(modalRefMock.hide).toHaveBeenCalled();
  });

  it('sollte als Default-Target stamm-0 wählen, wenn aus main verschoben wird', () => {
    expect(spectator.component.moveModalTarget()).toBe('stamm-0');
  });

  it('sollte als Default-Target main wählen, wenn aus einem Stamm oder Pool verschoben wird', () => {
    spectator.component.payload = { type: 'PARTICIPANT', sourceZone: 'stamm-1', data: {} } as any;
    spectator.component.ngOnInit();
    expect(spectator.component.moveModalTarget()).toBe('main');
  });
});