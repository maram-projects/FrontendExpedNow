import { TestBed } from '@angular/core/testing';

import { LogChatRoomAnalysisService } from './log-chat-room-analysis.service';

describe('LogChatRoomAnalysisService', () => {
  let service: LogChatRoomAnalysisService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LogChatRoomAnalysisService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
