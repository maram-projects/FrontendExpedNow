import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnterpriseRegisterComponent } from './enterprise-register.component';

describe('EnterpriseRegisterComponent', () => {
  let component: EnterpriseRegisterComponent;
  let fixture: ComponentFixture<EnterpriseRegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnterpriseRegisterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EnterpriseRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
