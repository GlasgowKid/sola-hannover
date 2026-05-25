import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GroupMember } from '../../../utils/ct-types';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';
import { DragPayload, GroupWrapper, StammItem } from '../stammes-einteilung/stammes-einteilung.component';

@Component({
  selector: 'app-participant-list',
  standalone: true,
  imports: [ParticipantCardComponent],
  templateUrl: './participant-list.component.html',
  styleUrl: './participant-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ParticipantListComponent {
  participants = input<StammItem[]>([]);
  dragOverZone = input<string | null>(null);
  showIds = input<boolean>(false);
  hasAnmeldungen = input<boolean>(false);
  availableAges = input<(number | null)[]>([]);
  details = input<boolean>(false);
  allParticipants = input<GroupMember[]>([]);

  filterChange = output<Event>();
  sortChange = output<Event>();
  groupingChange = output<Event>();
  searchChange = output<Event>();

  dragOverNode = output<DragEvent>();
  dragLeaveNode = output<DragEvent>();
  dropNode = output<DragEvent>();
  dragStartItem = output<{ event: DragEvent, payload: DragPayload }>();

  isGroupWrapper(item: any): item is GroupWrapper {
    return item && item.isWrapper === true;
  }

  getItemId(item: StammItem): string | number {
    return this.isGroupWrapper(item) ? item.id : item.id;
  }

  participantsAsMembers = computed(() => {
    const list: GroupMember[] = [];
    this.participants().forEach(item => {
      if (this.isGroupWrapper(item)) list.push(...item.participants);
      else list.push(item);
    });
    return list;
  });
}