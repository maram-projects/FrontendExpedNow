import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeliveryRatingModalComponent } from './delivery-rating-modal.component';

describe('DeliveryRatingModalComponent', () => {
  let component: DeliveryRatingModalComponent;
  let fixture: ComponentFixture<DeliveryRatingModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliveryRatingModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeliveryRatingModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
