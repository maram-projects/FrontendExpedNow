import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegisterLandingComponent } from './register-landing.component';

describe('RegisterLandingComponent', () => {
  let component: RegisterLandingComponent;
  let fixture: ComponentFixture<RegisterLandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterLandingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterLandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
