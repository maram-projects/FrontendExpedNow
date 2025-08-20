import { TestBed } from '@angular/core/testing';

import { AIAssistantService } from './aiassistant.service';

describe('AIAssistantService', () => {
  let service: AIAssistantService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AIAssistantService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
