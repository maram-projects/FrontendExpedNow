import { TestBed } from '@angular/core/testing';

import { DeleveryperService } from './deleveryper.service';

describe('DeleveryperService', () => {
  let service: DeleveryperService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DeleveryperService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
