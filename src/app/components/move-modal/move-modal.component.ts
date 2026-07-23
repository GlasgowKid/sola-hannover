import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { SortableModule } from 'ngx-bootstrap/sortable';
import { Subject } from 'rxjs';
import { GroupMember } from '../../../utils/ct-types';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';
import { DragPayload, GroupWrapper } from '../advanced-stammes-einteilung/advanced-stammes-einteilung.component';

@Component({
  selector: 'app-move-modal',
  standalone: true,
  imports: [ParticipantCardComponent, FormsModule, SortableModule],
  templateUrl: './move-modal.component.html'
})
export class MoveModalComponent implements OnInit {
  bsModalRef = inject(BsModalRef);

  payload!: DragPayload;
  extractedParticipants: GroupMember[] = [];
  showIds: boolean = false;
  details: boolean = false;
  allParticipants: GroupMember[] = [];
  staemmeCount: number = 0;
  pools: GroupWrapper[] = [];

  moveModalTarget = signal<string>('main');
  onClose = new Subject<{ target: string; participants: GroupMember[] } | null>();

  get staemmeIndices() {
    return Array.from({ length: this.staemmeCount }, (_, i) => i);
  }

  ngOnInit() {
    let defaultTarget = 'main';
    if (this.payload?.sourceZone === 'main') defaultTarget = 'stamm-0';
    else if (this.payload?.sourceZone.startsWith('stamm-') || this.payload?.sourceZone.startsWith('pool-')) defaultTarget = 'main';
    this.moveModalTarget.set(defaultTarget);
  }

  get unwrappedParticipants(): GroupMember[] {
    return this.extractedParticipants.map((p: any) => p.initData ? p.initData : p);
  }

  confirmMove() {
    this.onClose.next({ target: this.moveModalTarget(), participants: this.unwrappedParticipants });
    this.bsModalRef.hide();
  }

  cancel() {
    this.onClose.next(null);
    this.bsModalRef.hide();
  }
}