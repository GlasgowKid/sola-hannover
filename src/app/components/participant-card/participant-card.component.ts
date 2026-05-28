import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GroupMember } from '../../../utils/ct-types';
import { getMemberAge } from '../../../utils/age.util';
import { WunschAnzeige, getWunsch } from '../../../utils/wunsch.util';

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
  dblClickNode = output<MouseEvent>();
  resetNode = output<void>();

  age = computed(() => {
    return getMemberAge(this.item());
  });

  wunsch1 = computed(() => getWunsch(this.item(), 'Wunsch 1', this.allParticipants()));
  wunsch2 = computed(() => getWunsch(this.item(), 'Wunsch 2', this.allParticipants()));

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

  onDragStart(event: DragEvent) {
    this.dragStartNode.emit(event);
    event.stopPropagation();
  }

  onDoubleClick(event: MouseEvent) {
    this.dblClickNode.emit(event);
    event.stopPropagation();
  }

  onReset(event: Event) {
    this.resetNode.emit();
    event.stopPropagation();
  }
}