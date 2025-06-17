import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentSuccessModalComponent } from './payment-success-modal.component';

describe('PaymentSuccessModalComponent', () => {
  let component: PaymentSuccessModalComponent;
  let fixture: ComponentFixture<PaymentSuccessModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentSuccessModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentSuccessModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
