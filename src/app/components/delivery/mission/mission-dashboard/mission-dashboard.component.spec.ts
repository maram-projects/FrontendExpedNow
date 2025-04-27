import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MissionDashboardComponent } from './mission-dashboard.component';

describe('MissionDashboardComponent', () => {
  let component: MissionDashboardComponent;
  let fixture: ComponentFixture<MissionDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MissionDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MissionDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
