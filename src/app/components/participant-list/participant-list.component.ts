import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupMember } from '../../../utils/ct-types';
import { GroupWrapperCardComponent } from '../group-wrapper-card/group-wrapper-card.component';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';
import { DragPayload, GroupWrapper, StammItem } from '../stammes-einteilung/stammes-einteilung.component';

@Component({
  selector: 'app-participant-list',
  standalone: true,
  imports: [ParticipantCardComponent, GroupWrapperCardComponent, FormsModule],
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
  availableMaRollen = input<(string | null)[]>([]);
  dynamicRoles = input<any[]>([]);
  details = input<boolean>(false);
  allParticipants = input<GroupMember[]>([]);
  activeGrouping = input<string>('none');
  currentSort = input<string>('lastName_asc');

  roleFilterChange = output<Event>();
  filterChange = output<Event>();
  sortChange = output<string>();
  groupingChange = output<string>();
  searchChange = output<Event>();

  dragOverNode = output<DragEvent>();
  dragLeaveNode = output<DragEvent>();
  dropNode = output<DragEvent>();
  dragStartItem = output<{ event: DragEvent, payload: DragPayload }>();
  dblClickItem = output<{ event: MouseEvent, payload: DragPayload }>();

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