import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { ConfirmModalComponent } from './confirm-modal.component';

describe('ConfirmModalComponent', () => {
  let spectator: Spectator<ConfirmModalComponent>;
  let modalRefMock: any;

  const createComponent = createComponentFactory({
    component: ConfirmModalComponent,
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
  });

  it('sollte erstellt werden', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('sollte Standardtexte rendern', () => {
    expect(spectator.query('.modal-title')).toHaveText('Bestätigen');
    expect(spectator.query('.modal-body p')).toHaveText('Sind Sie sicher?');
    expect(spectator.query('.btn-primary')).toHaveText('Ja');
    expect(spectator.query('.btn-secondary')).toHaveText('Abbrechen');
  });

  it('sollte eigene Texte rendern', () => {
    spectator.component.title = 'Achtung';
    spectator.component.message = 'Wirklich löschen?';
    spectator.component.confirmText = 'Löschen';
    spectator.component.cancelText = 'Zurück';
    spectator.detectChanges();

    expect(spectator.query('.modal-title')).toHaveText('Achtung');
    expect(spectator.query('.modal-body p')).toHaveText('Wirklich löschen?');
    expect(spectator.query('.btn-primary')).toHaveText('Löschen');
    expect(spectator.query('.btn-secondary')).toHaveText('Zurück');
  });

  it('sollte den Abbrechen-Button verstecken, wenn cancelText leer ist', () => {
    spectator.component.cancelText = '';
    spectator.detectChanges();
    expect(spectator.query('.btn-secondary')).toBeFalsy();
  });

  it('sollte onClose mit true aufrufen und das Modal schließen bei confirm()', () => {
    let result: boolean | undefined;
    spectator.component.onClose.subscribe(res => (result = res));

    spectator.component.confirm();

    expect(result).toBe(true);
    expect(modalRefMock.hide).toHaveBeenCalled();
  });

  it('sollte onClose mit false aufrufen und das Modal schließen bei decline()', () => {
    let result: boolean | undefined;
    spectator.component.onClose.subscribe(res => (result = res));

    spectator.component.decline();

    expect(result).toBe(false);
    expect(modalRefMock.hide).toHaveBeenCalled();
  });

  it('sollte confirm() aufrufen, wenn der primäre Button geklickt wird', () => {
    jest.spyOn(spectator.component, 'confirm');
    spectator.click('.btn-primary');
    expect(spectator.component.confirm).toHaveBeenCalled();
  });

  it('sollte decline() aufrufen, wenn der sekundäre Button geklickt wird', () => {
    jest.spyOn(spectator.component, 'decline');
    spectator.click('.btn-secondary');
    expect(spectator.component.decline).toHaveBeenCalled();
  });

  it('sollte decline() aufrufen, wenn das X im Header geklickt wird', () => {
    jest.spyOn(spectator.component, 'decline');
    spectator.click('.btn-close');
    expect(spectator.component.decline).toHaveBeenCalled();
  });
});