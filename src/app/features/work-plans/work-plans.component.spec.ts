import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkPlansComponent } from './work-plans.component';

describe('WorkPlansComponent', () => {
  let component: WorkPlansComponent;
  let fixture: ComponentFixture<WorkPlansComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkPlansComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkPlansComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
