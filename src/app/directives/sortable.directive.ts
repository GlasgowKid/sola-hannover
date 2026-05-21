import { Directive, ElementRef, OnInit, OnDestroy, inject, Input, Output, EventEmitter } from '@angular/core';
import Sortable, { SortableEvent } from 'sortablejs';

@Directive({
  selector: '[sortable]',
  standalone: true
})
export class SortableDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef);
  
  @Input() sortableGroup: string = 'nested';
  @Input() sortableData: any;
  @Output() onDrop = new EventEmitter<{ item: any, from: any, to: any, oldIndex: number, newIndex: number }>();

  private sortable?: Sortable;

  ngOnInit() {
    this.sortable = new Sortable(this.el.nativeElement, {
      group: this.sortableGroup,
      animation: 150,
      fallbackOnBody: true,
      swapThreshold: 0.65,
      onAdd: (evt: SortableEvent) => {
        this.emitMove(evt);
      },
      onUpdate: (evt: SortableEvent) => {
        this.emitMove(evt);
      }
    });
  }

  private emitMove(evt: SortableEvent) {
    this.onDrop.emit({
      item: evt.item,
      from: (evt.from as any).getAttribute('data-list-id'),
      to: (evt.to as any).getAttribute('data-list-id'),
      oldIndex: evt.oldIndex!,
      newIndex: evt.newIndex!
    });
  }

  ngOnDestroy() { this.sortable?.destroy(); }
}