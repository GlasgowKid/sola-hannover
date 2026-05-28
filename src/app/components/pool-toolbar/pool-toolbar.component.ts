import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, HostListener, input, output, signal } from '@angular/core';
import { GroupMember } from '../../../utils/ct-types';
import { getMemberAge } from '../../../utils/age.util';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';
import { DragPayload, GroupWrapper } from '../stammes-einteilung/stammes-einteilung.component';

@Component({
  selector: 'app-pool-toolbar',
  standalone: true,
  imports: [ParticipantCardComponent, PercentPipe],
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

  getBoysCount(wrap: GroupWrapper) {
    return wrap.participants.filter(m => m.personFields?.sexId === 1).length;
  }

  getGirlsCount(wrap: GroupWrapper) {
    return wrap.participants.filter(m => m.personFields?.sexId === 2).length;
  }

  getValidAges(wrap: GroupWrapper) {
    return wrap.participants.map(m => getMemberAge(m)).filter((a): a is number => a !== null);
  }

  getAverageAge(wrap: GroupWrapper) {
    const ages = this.getValidAges(wrap);
    return ages.length ? Math.round(10 * ages.reduce((a, b) => a + b, 0) / ages.length) / 10 : 0;
  }

  getAgeVariance(wrap: GroupWrapper) {
    const ages = this.getValidAges(wrap);
    if (ages.length <= 1) return 0;
    const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    return Math.round((ages.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / ages.length) * 10) / 10;
  }
}