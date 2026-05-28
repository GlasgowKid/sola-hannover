import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { getMemberAge } from '../../../utils/age.util';
import { GroupMember } from '../../../utils/ct-types';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';
import { DragPayload, GroupWrapper } from '../stammes-einteilung/stammes-einteilung.component';

@Component({
  selector: 'app-group-wrapper-card',
  standalone: true,
  imports: [ParticipantCardComponent],
  templateUrl: './group-wrapper-card.component.html',
  styleUrl: './group-wrapper-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupWrapperCardComponent {
  group = input.required<GroupWrapper>();
  sourceZone = input.required<string>();

  payloadType = input<'GROUP' | 'POOL'>('GROUP');
  payloadData = input<any>();

  showIds = input<boolean>(false);
  details = input<boolean>(false);
  allParticipants = input<GroupMember[]>([]);
  currentZoneParticipants = input<GroupMember[]>([]);

  isDropZone = input<boolean>(false);
  dragOverZone = input<string | null>(null);
  showPoolStats = input<boolean>(false);

  dragStartItem = output<{ event: DragEvent, payload: DragPayload }>();
  dblClickItem = output<{ event: MouseEvent, payload: DragPayload }>();
  resetItem = output<GroupMember>();

  dragOverNode = output<DragEvent>();
  dragLeaveNode = output<DragEvent>();
  dropNode = output<DragEvent>();

  get payloadDataComputed() {
    return this.payloadData() !== undefined ? this.payloadData() : this.group();
  }

  boysCount = computed(() => this.group().participants.filter(m => m.personFields?.sexId === 1).length);
  girlsCount = computed(() => this.group().participants.filter(m => m.personFields?.sexId === 2).length);

  validAges = computed(() => {
    return this.group().participants
      .map(m => getMemberAge(m))
      .filter((a): a is number => a !== null);
  });

  averageAge = computed(() => {
    const ages = this.validAges();
    return ages.length ? Math.round(10 * ages.reduce((a, b) => a + b, 0) / ages.length) / 10 : 0;
  });

  ageVariance = computed(() => {
    const ages = this.validAges();
    if (ages.length <= 1) return 0;
    const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    return Math.round((ages.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / ages.length) * 10) / 10;
  });
}