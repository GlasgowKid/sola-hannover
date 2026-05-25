import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { isValid, parseISO } from 'date-fns';
import { GroupMember } from '../../../utils/ct-types';

export interface WunschAnzeige {
  text: string;
  status: 'open' | 'ignored' | 'confirmed';
  matchedPersonId?: number;
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
  currentZoneParticipants = input<GroupMember[]>([]);

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

  wunschAmpel = computed<{ color: string; tooltip: string } | null>(() => {
    if (this.sourceZone() === 'main') return null;

    const w1 = this.wunsch1();
    const w2 = this.wunsch2();
    const wishes = [w1, w2].filter((w): w is WunschAnzeige => w !== null);

    const confirmedWishes = wishes.filter(w => w.status === 'confirmed');
    const ignoredWishes = wishes.filter(w => w.status === 'ignored');

    if (confirmedWishes.length === 0) return null; // Keine zugeordneten Wünsche = Keine Ampel

    const currentZoneIds = new Set(this.currentZoneParticipants().map(p => p.id));
    let fulfilledCount = 0;

    confirmedWishes.forEach(w => {
      if (w.matchedPersonId !== undefined && currentZoneIds.has(w.matchedPersonId)) {
        fulfilledCount++;
      }
    });

    if (fulfilledCount === 0) return { color: 'danger', tooltip: 'kein zugeordneter Wunsch erfüllt' }; // Rot
    if (confirmedWishes.length === 2 && fulfilledCount === 1) return { color: 'warning', tooltip: 'zugeordnete Wünsche teilweise erfüllt' }; // Gelb
    if (fulfilledCount === confirmedWishes.length) {
      return ignoredWishes.length > 0 
        ? { color: 'primary', tooltip: 'alle zugeordneten Wünsche erfüllt' } 
        : { color: 'success', tooltip: 'alle Wünsche erfüllt' }; // Blau oder Grün
    }

    return null;
  });

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
          status: 'confirmed',
          matchedPersonId: matched.id
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