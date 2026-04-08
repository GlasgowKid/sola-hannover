import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SolaSelectorComponent } from './sola-selector.component';

describe('SolaSelectorComponent', () => {
  let component: SolaSelectorComponent;
  let fixture: ComponentFixture<SolaSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolaSelectorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SolaSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
