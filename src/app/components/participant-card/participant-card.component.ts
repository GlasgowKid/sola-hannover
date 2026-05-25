import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { isValid, parseISO } from 'date-fns';
import { GroupMember } from '../../../utils/ct-types';

export interface WunschAnzeige {
  text: string;
  status: 'open' | 'ignored' | 'confirmed';
}

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
  details = input<boolean>(false);
  allParticipants = input<GroupMember[]>([]);

  dragStartNode = output<DragEvent>();
  resetNode = output<void>();

  age = computed(() => {
    const birthday = this.item().personFields?.birthday;
    if (!birthday) return null;
    const bd = parseISO(String(birthday));
    return isValid(bd) ? new Date().getFullYear() - bd.getFullYear() : null;
  });

  wunsch1 = computed(() => this.getWunschText('Wunsch 1'));
  wunsch2 = computed(() => this.getWunschText('Wunsch 2'));

  private getWunschText(fieldName: string): WunschAnzeige | null {
    const field = this.item().fields?.find(f => f.name === fieldName);
    if (!field || !field.value) return null;
    const val = String(field.value).trim();

    if (val.toLowerCase().endsWith('(ignoriert)')) {
      return { text: val.substring(0, val.lastIndexOf('(ignoriert)')).trim(), status: 'ignored' };
    }

    if (val.startsWith('https://sola-hannover.church.tools/?q=churchdb#PersonView/searchEntry:%23')) {
      const matched = this.allParticipants().find(m => m.person?.frontendUrl === val);
      if (matched) {
        return { 
          text: `${matched.person.domainAttributes.firstName} ${matched.person.domainAttributes.lastName}`.trim(), 
          status: 'confirmed' 
        };
      }
      return { text: 'Unbekannter Link', status: 'confirmed' };
    }

    return { text: val, status: 'open' };
  }

  onDragStart(event: DragEvent) {
    this.dragStartNode.emit(event);
    event.stopPropagation();
  }

  onReset(event: Event) {
    this.resetNode.emit();
    event.stopPropagation();
  }
}