import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeliveryBonusComponent } from './delivery-bonus.component';

describe('DeliveryBonusComponent', () => {
  let component: DeliveryBonusComponent;
  let fixture: ComponentFixture<DeliveryBonusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliveryBonusComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeliveryBonusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
