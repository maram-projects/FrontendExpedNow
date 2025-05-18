import { Component, OnInit, ChangeDetectorRef, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FullCalendarModule } from '@fullcalendar/angular';
import { DayOfWeek, DaySchedule, AvailabilitySchedule, TimeRange } from '../../../models/availability.model';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';
import { User } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';
import { AvailabilityService } from '../../../services/availability.service';
// Fix #2: Correct import for DateClickArg
import { CalendarOptions, EventClickArg } from '@fullcalendar/core';
import { DateClickArg } from '@fullcalendar/interaction'; // Import from correct module
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, parse, startOfMonth, endOfMonth, addMonths, addDays, getDay } from 'date-fns';
import { Subject, forkJoin, Observable } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
// Fix #3: Create a temporary placeholder for ConfirmDialogComponent
// You'll need to create this component or adjust the import path
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  schedule?: T;
  data?: T;
  isNewSchedule?: boolean;
  existingSchedule?: any;
}

interface ValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface DeliveryPersonInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  available: boolean;
}

interface ScheduleStatistics {
  totalDeliveryPersons: number;
  withSchedule: number;
  withoutSchedule: number;
  scheduleCompletionRate: number;
}

interface CalendarEvent {
  title: string;
  start: string;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  display?: string;
  extendedProps: {
    isOverride?: boolean;
    isWeekly?: boolean;
    working: boolean;
    startTime: string | null;
    endTime: string | null;
  };
}

@Component({
  selector: 'app-availability-schedule',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatTabsModule,
    MatCardModule,
    MatSlideToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatExpansionModule,
    MatCheckboxModule,
    FullCalendarModule,
    MatSelectModule,
    MatOptionModule,
    MatDialogModule
  ],
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.css']
})
export class ScheduleComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Schedule data
  @Input() schedule: AvailabilitySchedule | undefined;
  @Output() scheduleChange = new EventEmitter<AvailabilitySchedule>();
  availabilitySchedule: AvailabilitySchedule | null = null;
  weeklySchedule: Record<DayOfWeek, DaySchedule> = {} as Record<DayOfWeek, DaySchedule>;
  
  // User data
  currentUser: User | null = null;
  isAdmin: boolean = false;
  deliveryPersons: User[] = [];
  selectedDeliveryPerson: User | null = null;
  availableDeliveryPersons: string[] = []; // Fix #1: Add property for available delivery persons
  
  // UI state
  isLoading = false;
  error = '';
  successMessage = '';
  showDateEditor = false;
  showWeekdaySelector = false;
  isOverride = false;
  
  // Calendar configuration
  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek'
    },
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    eventClick: this.handleEventClick.bind(this),
    dateClick: this.handleDateClick.bind(this),
    events: [],
    height: 'auto',
    contentHeight: 'auto',
    handleWindowResize: true
  };
  
  // Date editing
  selectedMonth: Date = new Date();
  selectedDate: Date | null = null;
  editingSchedule: DaySchedule = { working: false, startTime: null, endTime: null };
  
  // Range editing
  rangeStart: Date | null = null;
  rangeEnd: Date | null = null;
  rangeSchedule: DaySchedule = { working: false, startTime: null, endTime: null };
  selectedWeekdays: Record<DayOfWeek, boolean> = {} as Record<DayOfWeek, boolean>;
  
  // Availability checking
  checkDateTime: Date = new Date();
  
  // Constants
  daysOfWeek: DayOfWeek[] = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
    DayOfWeek.SUNDAY
  ];

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private userService: UserService,
    private availabilityService: AvailabilityService,
    private router: Router,
    private dialog: MatDialog
  ) {
    this.initializeDefaultState();
  }

  ngOnInit(): void {
    const currentAuthUser = this.authService.getCurrentUser();
    
    if (currentAuthUser) {
      this.currentUser = {
        id: currentAuthUser.userId,
        ...currentAuthUser,
        firstName: currentAuthUser.firstName || '',
        lastName: currentAuthUser.lastName || '',
        phone: currentAuthUser.phone || '',
        address: currentAuthUser.address || ''
      } as User;
      
      this.isAdmin = this.authService.isAdmin();
      
      if (this.isAdmin) {
        this.loadDeliveryPersons();
      } else {
        this.loadAvailabilitySchedule(currentAuthUser.userId);
      }
      
      if (this.schedule) {
        this.setScheduleData(this.schedule);
      }
    } else {
      this.handleAuthError();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeDefaultState(): void {
    this.daysOfWeek.forEach(day => {
      this.selectedWeekdays[day] = true;
    });
    this.weeklySchedule = this.initializeEmptyWeeklySchedule();
  }

  private handleAuthError(): void {
    this.error = 'Authentication required. Redirecting to login...';
    setTimeout(() => {
      this.authService.logout();
      this.router.navigate(['/login']);
    }, 2000);
  }

  private setScheduleData(schedule: AvailabilitySchedule): void {
    this.availabilitySchedule = schedule;
    this.weeklySchedule = schedule.weeklySchedule || this.initializeEmptyWeeklySchedule();
    this.updateCalendarEvents();
  }

  onDeliveryPersonSelected(event: MatSelectChange): void {
    const userId = event.value;
    if (!userId) {
      this.selectedDeliveryPerson = null;
      this.clearScheduleData();
      return;
    }
  
    const person = this.deliveryPersons.find(p => p.id === userId);
    if (!person?.id) {
      this.error = 'Selected delivery person not found or missing ID';
      this.selectedDeliveryPerson = null;
      return;
    }
  
    this.selectedDeliveryPerson = person;
    this.loadAvailabilitySchedule(person.id);
  }

  private clearScheduleData(): void {
    this.availabilitySchedule = null;
    this.weeklySchedule = this.initializeEmptyWeeklySchedule();
    this.updateCalendarEvents();
  }

  loadDeliveryPersons(): void {
    this.isLoading = true;
    this.userService.getDeliveryPersonnel()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (persons: User[]) => {
          this.deliveryPersons = persons;
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to load delivery persons:', err);
          this.error = 'Failed to load delivery persons';
        }
      });
  }

  loadAvailabilitySchedule(userId: string): void {
    if (!userId) {
      this.error = 'User ID is required';
      return;
    }
    
    this.isLoading = true;
    this.clearMessages();
    
    this.availabilityService.getSchedule(userId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response: ApiResponse<AvailabilitySchedule>) => {
          if (response.success && response.data) {
            this.setScheduleData(response.data);
          } else if (response.schedule) {
            this.setScheduleData(response.schedule);
          } else {
            this.error = 'No schedule data received';
          }
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 404) {
            this.initializeSchedule(userId);
          } else {
            console.error('Failed to load schedule:', err);
            this.error = 'Failed to load schedule. Please try again.';
          }
        }
      });
  }

  initializeSchedule(userId: string): void {
    if (!userId) {
      this.error = 'User ID is required';
      return;
    }
    
    this.isLoading = true;
    const emptySchedule: AvailabilitySchedule = this.createEmptySchedule(userId);

    const createSchedule$: Observable<ApiResponse<AvailabilitySchedule>> = this.isAdmin && this.selectedDeliveryPerson
      ? this.availabilityService.adminCreateScheduleForDeliveryPerson(userId, emptySchedule)
      : this.availabilityService.saveSchedule(emptySchedule);

    createSchedule$
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response: ApiResponse<AvailabilitySchedule>) => {
          if (response.success && (response.data || response.schedule)) {
            this.setScheduleData(response.data || response.schedule!);
            this.successMessage = 'Schedule created successfully!';
          } else {
            this.error = 'Failed to create schedule: Invalid response';
          }
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to create schedule:', err);
          this.error = 'Failed to create schedule';
        }
      });
  }

  private initializeEmptyWeeklySchedule(): Record<DayOfWeek, DaySchedule> {
    const schedule: Record<DayOfWeek, DaySchedule> = {} as Record<DayOfWeek, DaySchedule>;
    this.daysOfWeek.forEach(day => {
      schedule[day] = {
        working: false,
        startTime: null,
        endTime: null
      };
    });
    return schedule;
  }

  onWeeklyToggleChange(day: DayOfWeek): void {
    const daySchedule = this.weeklySchedule[day];
    if (!daySchedule.working) {
      daySchedule.startTime = null;
      daySchedule.endTime = null;
    } else if (!daySchedule.startTime || !daySchedule.endTime) {
      daySchedule.startTime = '09:00';
      daySchedule.endTime = '17:00';
    }
  }

  updateDaySchedule(day: DayOfWeek): void {
    if (!this.availabilitySchedule) return;
    
    const userId = this.getEffectiveUserId();
    if (!userId) {
      this.error = 'User ID is required';
      return;
    }
      
    const daySchedule = this.weeklySchedule[day];
    
    this.isLoading = true;
    this.availabilityService.updateDayAvailability(
      userId, 
      day, 
      daySchedule.working,
      daySchedule.startTime || undefined,
      daySchedule.endTime || undefined
    )
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (schedule: AvailabilitySchedule) => {
        this.setScheduleData(schedule);
        this.scheduleChange.emit(schedule);
        this.successMessage = `${this.getDayName(day)} schedule updated!`;
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to update day schedule:', err);
        this.error = `Failed to update ${this.getDayName(day)} schedule`;
      }
    });
  }

  saveWeeklySchedule(): void {
    const userId = this.getEffectiveUserId();
    if (!userId) {
      this.error = 'Unable to determine user ID';
      return;
    }
    
    const updatedSchedule: AvailabilitySchedule = {
      ...(this.availabilitySchedule || this.createEmptySchedule(userId)),
      userId: userId,
      weeklySchedule: this.weeklySchedule
    };
    
    this.isLoading = true;
    this.clearMessages();
    
    this.availabilityService.saveSchedule(updatedSchedule)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response: ApiResponse<AvailabilitySchedule>) => {
          if (response.success && (response.data || response.schedule)) {
            this.setScheduleData(response.data || response.schedule!);
            this.successMessage = 'Weekly schedule saved successfully!';
            this.scheduleChange.emit(this.availabilitySchedule!);
          } else {
            this.error = 'Failed to save schedule: Invalid response';
          }
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to save schedule:', err);
          this.error = err.error?.message || 'Failed to save schedule';
        }
      });
  }

  handleEventClick(clickInfo: EventClickArg): void {
    if (!this.availabilitySchedule) return;
    
    const date = clickInfo.event.start;
    if (!date) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const daySchedule = this.availabilitySchedule.monthlySchedule[dateStr];
    
    if (daySchedule) {
      this.selectedDate = date;
      this.editingSchedule = { ...daySchedule };
      this.isOverride = true;
      this.showDateEditor = true;
      this.cdr.detectChanges();
    }
  }

  handleDateClick(clickInfo: DateClickArg): void {
    this.selectedDate = clickInfo.date;
    const dateStr = this.selectedDate ? format(this.selectedDate, 'yyyy-MM-dd') : '';
    
    if (this.availabilitySchedule?.monthlySchedule && dateStr && this.availabilitySchedule.monthlySchedule[dateStr]) {
      this.editingSchedule = { ...this.availabilitySchedule.monthlySchedule[dateStr] };
      this.isOverride = true;
    } else if (this.selectedDate) {
      const dayOfWeek = this.getDayOfWeekFromDate(this.selectedDate);
      if (this.weeklySchedule[dayOfWeek]) {
        this.editingSchedule = { ...this.weeklySchedule[dayOfWeek] };
      } else {
        this.editingSchedule = { working: false, startTime: null, endTime: null };
      }
      this.isOverride = false;
    }
    
    this.showDateEditor = true;
    this.cdr.detectChanges();
  }

  onDateToggleChange(): void {
    if (!this.editingSchedule.working) {
      this.editingSchedule.startTime = null;
      this.editingSchedule.endTime = null;
    } else if (this.editingSchedule.startTime === null || this.editingSchedule.endTime === null) {
      this.editingSchedule.startTime = '09:00';
      this.editingSchedule.endTime = '17:00';
    }
    this.cdr.detectChanges();
  }

  saveDateSchedule(): void {
    if (!this.availabilitySchedule || !this.selectedDate) {
      this.error = 'No schedule or date selected';
      return;
    }
    
    const userId = this.getEffectiveUserId();
    if (!userId) {
      this.error = 'User ID is required';
      return;
    }
      
    const dateStr = format(this.selectedDate, 'yyyy-MM-dd');
    
    this.isLoading = true;
    this.clearMessages();
    
    const updateMethod = this.isAdmin && this.selectedDeliveryPerson
      ? this.availabilityService.adminUpdateDateAvailability.bind(this.availabilityService)
      : this.availabilityService.updateDateAvailability.bind(this.availabilityService);
    
    updateMethod(
      userId,
      dateStr,
      this.editingSchedule.working,
      this.editingSchedule.startTime || undefined,
      this.editingSchedule.endTime || undefined
    )
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (schedule: AvailabilitySchedule) => {
        this.setScheduleData(schedule);
        this.successMessage = `Schedule for ${format(this.selectedDate!, 'MMM dd, yyyy')} updated!`;
        this.showDateEditor = false;
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to update date schedule:', err);
        this.error = 'Failed to update date schedule';
      }
    });
  }

  cancelDateEdit(): void {
    this.showDateEditor = false;
    this.clearMessages();
  }

  removeDateOverride(): void {
    if (!this.availabilitySchedule || !this.selectedDate) {
      this.error = 'No schedule or date selected';
      return;
    }
    
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Confirm Removal',
        message: 'Are you sure you want to remove this date override?'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.performDateOverrideRemoval();
      }
    });
  }

  private performDateOverrideRemoval(): void {
    const userId = this.getEffectiveUserId();
    if (!userId) {
      this.error = 'User ID is required';
      return;
    }
      
    const dateStr = format(this.selectedDate!, 'yyyy-MM-dd');
    
    this.isLoading = true;
    this.clearMessages();
    
    const clearMethod = this.isAdmin && this.selectedDeliveryPerson
      ? this.availabilityService.adminClearDateAvailability.bind(this.availabilityService)
      : this.availabilityService.clearDateAvailability.bind(this.availabilityService);
    
    clearMethod(userId, dateStr)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (schedule: AvailabilitySchedule) => {
          this.setScheduleData(schedule);
          this.successMessage = `Override for ${format(this.selectedDate!, 'MMM dd, yyyy')} removed!`;
          this.showDateEditor = false;
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to remove date override:', err);
          this.error = 'Failed to remove date override';
        }
      });
  }

  onRangeToggleChange(): void {
    if (!this.rangeSchedule.working) {
      this.rangeSchedule.startTime = null;
      this.rangeSchedule.endTime = null;
      this.showWeekdaySelector = false;
    } else {
      if (this.rangeSchedule.startTime === null || this.rangeSchedule.endTime === null) {
        this.rangeSchedule.startTime = '09:00';
        this.rangeSchedule.endTime = '17:00';
      }
      this.showWeekdaySelector = true;
    }
    this.cdr.detectChanges();
  }

  isRangeValid(): boolean {
    return !!(this.rangeStart && this.rangeEnd && this.rangeStart <= this.rangeEnd);
  }

  applyDateRange(): void {
    if (!this.rangeStart || !this.rangeEnd) {
      this.error = 'Please select start and end dates';
      return;
    }

    if (this.rangeStart > this.rangeEnd) {
      this.error = 'Start date must be before end date';
      return;
    }

    if (this.rangeSchedule.working && 
        (this.rangeSchedule.startTime === null || this.rangeSchedule.endTime === null)) {
      this.error = 'Start and end times are required for working days';
      return;
    }

    const userId = this.getEffectiveUserId();
    if (!userId) {
      this.error = 'User not found';
      return;
    }

    this.isLoading = true;
    this.clearMessages();

    const updateMethod = this.isAdmin && this.selectedDeliveryPerson
      ? this.availabilityService.adminUpdateDateRangeAvailability.bind(this.availabilityService)
      : this.availabilityService.updateDateRangeAvailability.bind(this.availabilityService);

    updateMethod(
      userId,
      format(this.rangeStart, 'yyyy-MM-dd'),
      format(this.rangeEnd, 'yyyy-MM-dd'),
      this.rangeSchedule.working,
      this.rangeSchedule.startTime || undefined,
      this.rangeSchedule.endTime || undefined
    )
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (schedule: AvailabilitySchedule) => {
        this.setScheduleData(schedule);
        this.successMessage = 'Date range updated successfully!';
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error updating date range:', err);
        this.error = err.error?.message || 'An unexpected error occurred';
      }
    });
  }

  clearDateRange(): void {
    if (!this.availabilitySchedule || !this.rangeStart || !this.rangeEnd) {
      this.error = 'No schedule or date range selected';
      return;
    }
    
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Confirm Clear',
        message: 'Are you sure you want to clear availability for this date range?'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.performDateRangeClear();
      }
    });
  }

  private performDateRangeClear(): void {
    const userId = this.getEffectiveUserId();
    if (!userId) {
      this.error = 'User ID is required';
      return;
    }
      
    const startDateStr = format(this.rangeStart!, 'yyyy-MM-dd');
    const endDateStr = format(this.rangeEnd!, 'yyyy-MM-dd');
    
    this.isLoading = true;
    this.clearMessages();
    
    const clearMethod = this.isAdmin && this.selectedDeliveryPerson
      ? this.availabilityService.adminClearDateRangeAvailability.bind(this.availabilityService)
      : this.availabilityService.clearDateRangeAvailability.bind(this.availabilityService);
    
    clearMethod(
      userId,
      startDateStr,
      endDateStr
    )
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (schedule: AvailabilitySchedule) => {
        this.setScheduleData(schedule);
        this.successMessage = 'Date range cleared successfully!';
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to clear date range:', err);
        this.error = 'Failed to clear date range';
      }
    });
  }

  onMonthChange(): void {
    this.updateCalendarEvents();
  }

  onMonthSelected(date: Date): void {
    this.selectedMonth = date;
    this.updateCalendarEvents();
  }

  generateMonthFromWeekly(): void {
    if (!this.availabilitySchedule) {
      this.error = 'No schedule available';
      return;
    }
    
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Confirm Generation',
        message: 'This will overwrite any existing monthly schedule for the selected month. Continue?'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.performMonthGeneration();
      }
    });
  }

  private performMonthGeneration(): void {
    const userId = this.getEffectiveUserId();
    if (!userId) {
      this.error = 'User ID is required';
      return;
    }
      
    const monthStart = startOfMonth(this.selectedMonth);
    const monthEnd = endOfMonth(this.selectedMonth);
    
    this.isLoading = true;
    this.clearMessages();
    
    this.availabilityService.generateMonthlyFromWeekly(
      userId,
      format(monthStart, 'yyyy-MM-dd'),
      format(monthEnd, 'yyyy-MM-dd')
    )
    .pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    )
    .subscribe({
      next: (schedule: AvailabilitySchedule) => {
        this.setScheduleData(schedule);
        this.successMessage = 'Monthly schedule generated from weekly schedule!';
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to generate monthly schedule:', err);
        this.error = 'Failed to generate monthly schedule';
      }
    });
  }

  clearMonthSchedule(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Confirm Clear',
        message: 'Are you sure you want to clear the entire monthly schedule?'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.performMonthClear();
      }
    });
  }

  private performMonthClear(): void {
    const userId = this.getEffectiveUserId();
    if (!userId) {
      this.error = 'User ID is required';
      return;
    }
    
    this.isLoading = true;
    this.clearMessages();
    
    this.availabilityService.clearMonthlySchedule(userId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (schedule: AvailabilitySchedule) => {
          this.setScheduleData(schedule);
          this.successMessage = 'Monthly schedule cleared!';
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to clear monthly schedule:', err);
          this.error = 'Failed to clear monthly schedule';
        }
      });
  }

  checkAvailability(): void {
    const userId = this.getEffectiveUserId();
    if (!userId) {
      this.error = 'User ID is required';
      return;
    }
      
    const dateTimeStr = format(this.checkDateTime, "yyyy-MM-dd'T'HH:mm");
    
    this.availabilityService.checkDateTimeAvailability(userId, dateTimeStr)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (isAvailable: boolean) => {
          const userName = this.isAdmin && this.selectedDeliveryPerson 
            ? `${this.selectedDeliveryPerson.firstName} ${this.selectedDeliveryPerson.lastName}` 
            : 'You are';
            
          alert(`${userName} ${isAvailable ? 'available' : 'not available'} at the selected time.`);
        },
        error: (err: HttpErrorResponse) => {
          console.error('Failed to check availability:', err);
          this.error = 'Failed to check availability';
          this.cdr.detectChanges();
        }
      });
  }

  private updateCalendarEvents(): void {
    if (!this.availabilitySchedule) return;

    const events: CalendarEvent[] = [];
    const monthStart = startOfMonth(this.selectedMonth);
    const monthEnd = endOfMonth(this.selectedMonth);

    // Add weekly schedule events
    this.daysOfWeek.forEach(day => {
      const daySchedule = this.weeklySchedule[day];
      if (daySchedule.working) {
        let currentDate = new Date(monthStart);
        
        while (currentDate <= monthEnd) {
          if (this.getDayOfWeekFromDate(currentDate) === day) {
            const dateStr = format(currentDate, 'yyyy-MM-dd');
            
            // Only add if there's no monthly override
            if (!this.availabilitySchedule?.monthlySchedule[dateStr]) {
              events.push(this.createCalendarEvent(
                currentDate,
                daySchedule,
                false,
                true
              ));
            }
          }
          currentDate = addDays(currentDate, 1);
        }
      }
    });

    // Add monthly override events
    if (this.availabilitySchedule.monthlySchedule) {
      Object.entries(this.availabilitySchedule.monthlySchedule).forEach(([dateStr, daySchedule]) => {
        const dateObj = new Date(dateStr);
        if (dateObj >= monthStart && dateObj <= monthEnd) {
          events.push(this.createCalendarEvent(
            dateObj,
            daySchedule,
            true,
            false
          ));
        }
      });
    }

    this.calendarOptions.events = events;
    this.cdr.detectChanges();
  }

  private createCalendarEvent(
    date: Date,
    daySchedule: DaySchedule,
    isOverride: boolean,
    isWeekly: boolean
  ): CalendarEvent {
    return {
      title: daySchedule.working ? 
        `Available ${daySchedule.startTime}-${daySchedule.endTime}` : 
        'Not Available',
      start: format(date, 'yyyy-MM-dd'),
      allDay: true,
      backgroundColor: daySchedule.working ? 
        (isOverride ? '#4CAF50' : '#2196F3') : 
        (isOverride ? '#F44336' : '#9E9E9E'),
      borderColor: daySchedule.working ? 
        (isOverride ? '#388E3C' : '#1976D2') : 
        (isOverride ? '#D32F2F' : '#616161'),
      extendedProps: {
        isOverride,
        isWeekly,
        working: daySchedule.working,
        startTime: daySchedule.startTime,
        endTime: daySchedule.endTime
      }
    };
  }

  private getEffectiveUserId(): string {
    if (this.isAdmin && this.selectedDeliveryPerson?.id) {
      return this.selectedDeliveryPerson.id;
    }
    return this.currentUser?.id || '';
  }

  private clearMessages(): void {
    this.error = '';
    this.successMessage = '';
  }

  private createEmptySchedule(userId: string): AvailabilitySchedule {
    return {
      userId: userId,
      weeklySchedule: this.initializeEmptyWeeklySchedule(),
      monthlySchedule: {}
    };
  }

  getDayName(day: DayOfWeek): string {
    return DayOfWeek[day];
  }

  private getDayOfWeekFromDate(date: Date): DayOfWeek {
    const dayIndex = getDay(date); // 0 (Sunday) to 6 (Saturday)
    return [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY
    ][dayIndex];
  }
}