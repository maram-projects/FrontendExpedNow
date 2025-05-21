import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientDiscountsComponent } from './client-discounts.component';

describe('ClientDiscountsComponent', () => {
  let component: ClientDiscountsComponent;
  let fixture: ComponentFixture<ClientDiscountsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientDiscountsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientDiscountsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
