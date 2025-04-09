import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeliveryRequestComponent } from './delivery-request.component';

describe('DeliveryRequestComponent', () => {
  let component: DeliveryRequestComponent;
  let fixture: ComponentFixture<DeliveryRequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliveryRequestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeliveryRequestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
