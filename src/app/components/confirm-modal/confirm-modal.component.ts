import { Component, OnDestroy } from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  template: `
    <div class="modal-header">
      <h5 class="modal-title m-0">{{ title }}</h5>
      <button type="button" class="btn-close" aria-label="Close" (click)="decline()"></button>
    </div>
    <div class="modal-body">
      <p class="m-0">{{ message }}</p>
    </div>
    <div class="modal-footer">
      @if (cancelText) {
        <button type="button" class="btn btn-secondary" (click)="decline()">{{ cancelText }}</button>
      }
      <button type="button" class="btn btn-primary" (click)="confirm()">{{ confirmText }}</button>
    </div>
  `
})
export class ConfirmModalComponent implements OnDestroy {
  title: string = 'Bestätigen';
  message: string = 'Sind Sie sicher?';
  confirmText: string = 'Ja';
  cancelText: string = 'Abbrechen';

  public onClose = new Subject<boolean>();
  private hasEmitted = false;

  constructor(public bsModalRef: BsModalRef) { }

  confirm(): void {
    this.hasEmitted = true;
    this.onClose.next(true);
    this.bsModalRef.hide();
  }

  decline(): void {
    this.hasEmitted = true;
    this.onClose.next(false);
    this.bsModalRef.hide();
  }

  ngOnDestroy(): void {
    if (!this.hasEmitted) {
      this.onClose.next(false);
    }
    this.onClose.complete();
  }
}