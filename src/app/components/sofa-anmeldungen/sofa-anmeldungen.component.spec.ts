import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SofaAnmeldungenComponent } from './sofa-anmeldungen.component';

describe('SofaAnmeldungenComponent', () => {
  let component: SofaAnmeldungenComponent;
  let fixture: ComponentFixture<SofaAnmeldungenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SofaAnmeldungenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SofaAnmeldungenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
