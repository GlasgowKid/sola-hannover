import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { GroupMember } from '../../../utils/ct-types';
import { ParticipantCardComponent } from '../participant-card/participant-card.component';
import { DragPayload } from '../stammes-einteilung/stammes-einteilung.component';

@Component({
  selector: 'app-participant-list',
  standalone: true,
  imports: [ParticipantCardComponent],
  templateUrl: './participant-list.component.html',
  styleUrl: './participant-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ParticipantListComponent {
  participants = input<GroupMember[]>([]);
  dragOverZone = input<string | null>(null);
  showIds = input<boolean>(false);
  hasAnmeldungen = input<boolean>(false);
  availableAges = input<(number | null)[]>([]);
  details = input<boolean>(false);
  allParticipants = input<GroupMember[]>([]);

  filterChange = output<Event>();
  sortChange = output<Event>();
  searchChange = output<Event>();

  dragOverNode = output<DragEvent>();
  dragLeaveNode = output<DragEvent>();
  dropNode = output<DragEvent>();
  dragStartItem = output<{ event: DragEvent, payload: DragPayload }>();
}