import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AIAssistantComponent } from './aiassistant.component';

describe('AIAssistantComponent', () => {
  let component: AIAssistantComponent;
  let fixture: ComponentFixture<AIAssistantComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AIAssistantComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AIAssistantComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
