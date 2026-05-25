import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { isValid, parseISO } from 'date-fns';
import { GroupMember } from '../../../utils/ct-types';
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

  toggleIds = output<void>();
  toggleDetails = output<void>();
  confirmLoadServer = output<void>();
  saveGroupsServer = output<void>();

  dragOverNode = output<{ event: DragEvent, zone: string }>();
  dragLeaveNode = output<{ event: DragEvent, zone: string }>();
  dropNode = output<{ event: DragEvent, zone: string }>();
  dragStartItem = output<{ event: DragEvent, payload: DragPayload }>();
  resetItem = output<GroupMember>();

  getBoysCount(wrap: GroupWrapper) {
    return wrap.participants.filter(m => m.personFields?.sexId === 1).length;
  }

  getGirlsCount(wrap: GroupWrapper) {
    return wrap.participants.filter(m => m.personFields?.sexId === 2).length;
  }

  getValidAges(wrap: GroupWrapper) {
    return wrap.participants.map(m => {
      const birthday = m.personFields?.birthday;
      if (!birthday) return null;
      const bd = parseISO(String(birthday));
      return isValid(bd) ? new Date().getFullYear() - bd.getFullYear() : null;
    }).filter((a): a is number => a !== null && a > 0);
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