import { TestBed } from '@angular/core/testing';
import { DeliveryService } from './delivery-service.service';


describe('DeliveryServiceService', () => {
  let service: DeliveryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DeliveryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
