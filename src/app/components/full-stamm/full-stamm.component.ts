import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { getMemberAge } from '../../../utils/age.util';
import { GroupMember } from '../../../utils/ct-types';
import { GroupWrapperCardComponent } from '../group-wrapper-card/group-wrapper-card.component';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';
import { DragPayload, GroupWrapper, StammItem } from '../stammes-einteilung/stammes-einteilung.component';

@Component({
  selector: 'app-stamm',
  standalone: true,
  imports: [ParticipantCardComponent, GroupWrapperCardComponent],
  templateUrl: './full-stamm.component.html',
  styleUrl: './full-stamm.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MAStammComponent {
  stammIdx = input.required<number>();
  TN = input.required<StammItem[]>();
  dragOverZone = input<string | null>(null);
  showIds = input<boolean>(false);
  details = input<boolean>(false);
  allParticipants = input<GroupMember[]>([]);

  flatParticipants = computed(() => {
    const flat: GroupMember[] = [];
    this.TN().forEach(item => {
      if (this.isGroupWrapper(item)) flat.push(...item.participants);
      else flat.push(item);
    });
    return flat;
  });

  boysCount = computed(() => this.flatParticipants().filter(m => m.personFields?.sexId === 1).length);
  girlsCount = computed(() => this.flatParticipants().filter(m => m.personFields?.sexId === 2).length);

  validAges = computed(() => {
    return this.flatParticipants()
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

  dragOverNode = output<DragEvent>();
  dragLeaveNode = output<DragEvent>();
  dropNode = output<DragEvent>();
  dragStartItem = output<{ event: DragEvent, payload: DragPayload }>();
  dblClickItem = output<{ event: MouseEvent, payload: DragPayload }>();
  resetItem = output<GroupMember>();

  isGroupWrapper(item: any): item is GroupWrapper { return item && item.isWrapper === true; }

  getItemId(item: StammItem): string | number { return this.isGroupWrapper(item) ? item.id : item.id; }
}