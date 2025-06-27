import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminBonusesComponent } from './admin-bonuses.component';


describe('AdminBonusesComponent', () => {
  let component: AdminBonusesComponent;
  let fixture: ComponentFixture<AdminBonusesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminBonusesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminBonusesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
