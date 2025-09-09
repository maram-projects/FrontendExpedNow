import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RatingDetailsModalComponent } from './rating-details-modal.component';

describe('RatingDetailsModalComponent', () => {
  let component: RatingDetailsModalComponent;
  let fixture: ComponentFixture<RatingDetailsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RatingDetailsModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RatingDetailsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
