import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { isValid, parseISO } from 'date-fns';
import { GroupMember } from '../../../utils/ct-types';

@Component({
  selector: 'app-participant-card',
  standalone: true,
  imports: [NgClass],
  templateUrl: './participant-card.component.html',
  styleUrl: './participant-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ParticipantCardComponent {
  item = input.required<GroupMember>();
  sourceZone = input.required<string>();
  showIds = input<boolean>(false);

  dragStartNode = output<DragEvent>();
  resetNode = output<void>();

  age = computed(() => {
    const birthday = this.item().personFields?.birthday;
    if (!birthday) return null;
    const bd = parseISO(String(birthday));
    return isValid(bd) ? new Date().getFullYear() - bd.getFullYear() : null;
  });

  onDragStart(event: DragEvent) {
    this.dragStartNode.emit(event);
    event.stopPropagation();
  }

  onReset(event: Event) {
    this.resetNode.emit();
    event.stopPropagation();
  }
}