import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnmeldungenComponent } from './anmeldungen.component';

describe('AnmeldungenComponent', () => {
  let component: AnmeldungenComponent;
  let fixture: ComponentFixture<AnmeldungenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnmeldungenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnmeldungenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
