import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeliveryChatComponent } from './delivery-chat-component.component';

describe('DeliveryChatComponent', () => {
  let component: DeliveryChatComponent;
  let fixture: ComponentFixture<DeliveryChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliveryChatComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeliveryChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});