import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemporaryRegisterComponent } from './temporary-register.component';

describe('TemporaryRegisterComponent', () => {
  let component: TemporaryRegisterComponent;
  let fixture: ComponentFixture<TemporaryRegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemporaryRegisterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TemporaryRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
