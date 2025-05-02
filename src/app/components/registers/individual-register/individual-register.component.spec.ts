import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IndividualRegisterComponent } from './individual-register.component';

describe('IndividualRegisterComponent', () => {
  let component: IndividualRegisterComponent;
  let fixture: ComponentFixture<IndividualRegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IndividualRegisterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IndividualRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
