import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfessionalRegisterDialogComponent } from './professional-register-dialog.component';

describe('ProfessionalRegisterDialogComponent', () => {
  let component: ProfessionalRegisterDialogComponent;
  let fixture: ComponentFixture<ProfessionalRegisterDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfessionalRegisterDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfessionalRegisterDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
