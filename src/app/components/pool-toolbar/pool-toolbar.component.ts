import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, HostListener, input, output, signal } from '@angular/core';
import { GroupMember } from '../../../utils/ct-types';
import { GroupWrapperCardComponent } from '../group-wrapper-card/group-wrapper-card.component';
import { DragPayload, GroupWrapper } from '../stammes-einteilung/stammes-einteilung.component';

@Component({
  selector: 'app-pool-toolbar',
  standalone: true,
  imports: [GroupWrapperCardComponent, PercentPipe],
  templateUrl: './pool-toolbar.component.html',
  styleUrl: './pool-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PoolToolbarComponent {
  pools = input<GroupWrapper[]>([]);
  dragOverZone = input<string | null>(null);
  showIds = input<boolean>(false);
  details = input<boolean>(false);
  progress = input<number>(0);
  isDirty = input<boolean>(false);
  isDragging = input<boolean>(false);
  allParticipants = input<GroupMember[]>([]);

  dragTop = signal<number>(0);

  toggleIds = output<void>();
  toggleDetails = output<void>();
  confirmLoadServer = output<void>();
  saveGroupsServer = output<void>();

  dragOverNode = output<{ event: DragEvent, zone: string }>();
  dragLeaveNode = output<{ event: DragEvent, zone: string }>();
  dropNode = output<{ event: DragEvent, zone: string }>();
  dragStartItem = output<{ event: DragEvent, payload: DragPayload }>();
  dblClickItem = output<{ event: MouseEvent, payload: DragPayload }>();
  resetItem = output<GroupMember>();

  constructor() {
    effect(() => {
      if (this.isDragging()) {
        this.updatePosition();
      }
    });
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  updatePosition() {
    if (this.isDragging()) {
      this.dragTop.set(window.innerHeight - 95 + window.scrollY);
    }
  }
}