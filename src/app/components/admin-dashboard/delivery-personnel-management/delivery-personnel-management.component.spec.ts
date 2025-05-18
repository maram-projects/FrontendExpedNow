import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeliveryPersonnelManagementComponent } from './delivery-personnel-management.component';

describe('DeliveryPersonnelManagementComponent', () => {
  let component: DeliveryPersonnelManagementComponent;
  let fixture: ComponentFixture<DeliveryPersonnelManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliveryPersonnelManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeliveryPersonnelManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
