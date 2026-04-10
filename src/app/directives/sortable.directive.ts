import { Directive, ElementRef, OnInit, OnDestroy, inject, Input, Output, EventEmitter } from '@angular/core';
import Sortable from 'sortablejs';

@Directive({
  selector: '[sortable]',
  standalone: true
})
export class SortableDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef);
  
  @Input() list: any[] = []; 
  @Output() listChange = new EventEmitter<any[]>();

  private sortable?: Sortable;

  ngOnInit() {
    this.sortable = new Sortable(this.el.nativeElement, {
      group: 'participants-shared-pool', // Identical name across all lists enables nesting
      animation: 150,
      fallbackOnBody: true,
      swapThreshold: 0.65,
      // Triggered whenever a drag-and-drop operation finishes
      onEnd: (evt) => {
        // We handle the data transfer logic in the component to manage multi-signal updates
        // This 'onEnd' is kept simple to avoid conflicts with shared pool logic
      },
      // When an item is dropped into THIS list from another list
      onAdd: (evt) => {
        // Handled by component logic via event capturing or shared methods
      }
    });
  }

  ngOnDestroy() { this.sortable?.destroy(); }
}