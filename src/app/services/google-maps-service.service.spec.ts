import { TestBed } from '@angular/core/testing';
import { MapService } from './google-maps-service.service';


describe('GoogleMapsServiceService', () => {
  let service: MapService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
