import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SolaTeilnehmerAnmeldungenComponent } from './sola-teilnehmer-anmeldungen.component';

describe('SolaTeilnehmerAnmeldungenComponent', () => {
  let component: SolaTeilnehmerAnmeldungenComponent;
  let fixture: ComponentFixture<SolaTeilnehmerAnmeldungenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolaTeilnehmerAnmeldungenComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SolaTeilnehmerAnmeldungenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
