import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StammesManagementComponent } from './stammes-management.component';

describe('StammesManagementComponent', () => {
  let component: StammesManagementComponent;
  let fixture: ComponentFixture<StammesManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StammesManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StammesManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
