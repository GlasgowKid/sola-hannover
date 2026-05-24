import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { BsModalService } from 'ngx-bootstrap/modal';
import { Observable } from 'rxjs';
import { ConfirmModalComponent } from '../components/confirm-modal/confirm-modal.component';

export interface CanComponentDeactivate {
  canDeactivate: () => Observable<boolean> | Promise<boolean> | boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<CanComponentDeactivate> = (component) => {
  const canDeactivate = component.canDeactivate ? component.canDeactivate() : true;
  if (typeof canDeactivate === 'boolean' && canDeactivate) {
    return true;
  }

  const modalService = inject(BsModalService);
  const bsModalRef = modalService.show(ConfirmModalComponent, {
    initialState: {
      title: 'Ungespeicherte Änderungen',
      message: 'Sie haben ungespeicherte Änderungen. Möchten Sie die Seite wirklich verlassen? Änderungen gehen dabei verloren.',
      confirmText: 'Seite verlassen',
      cancelText: 'Bleiben'
    }
  });
  return bsModalRef.content!.onClose.asObservable();
};