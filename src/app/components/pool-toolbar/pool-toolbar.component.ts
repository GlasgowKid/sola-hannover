import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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

  toggleIds = output<void>();
  toggleDetails = output<void>();
  confirmLoadServer = output<void>();
  saveGroupsServer = output<void>();

  dragOverNode = output<{ event: DragEvent, zone: string }>();
  dragLeaveNode = output<{ event: DragEvent, zone: string }>();
  dropNode = output<{ event: DragEvent, zone: string }>();
  dragStartItem = output<{ event: DragEvent, payload: DragPayload }>();
  resetItem = output<GroupMember>();
}