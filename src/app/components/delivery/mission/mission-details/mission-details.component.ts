import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Mission } from '../../../../models/mission.model';
import { MissionService } from '../../../../services/mission-service.service';

interface MissionViewModel extends Mission {
  parsedStartTime?: Date | null;
  parsedEndTime?: Date | null;
}

@Component({
  selector: 'app-mission-details',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './mission-details.component.html',
  styleUrls: ['./mission-details.component.css']
})
export class MissionDetailsComponent {
  @Input() missionId: string | null = null;
  @Output() closeDialogEvent = new EventEmitter<void>();
  @Output() missionUpdated = new EventEmitter<Mission>();
  
  mission: MissionViewModel | null = null;
  errorMessage: string = '';
  
  constructor(private missionService: MissionService) {}
  
  ngOnChanges() {
    if (this.missionId) {
      this.loadMissionDetails();
    }
  }
  
  loadMissionDetails() {
    if (!this.missionId) return;
    
    this.missionService.getMissionDetails(this.missionId).subscribe({
      next: (data: Mission) => {
        this.mission = {
          ...data,
          parsedStartTime: this.parseDate(data.startTime),
          parsedEndTime: data.endTime ? this.parseDate(data.endTime) : null
        };
      },
      error: (err) => {
        console.error('Error loading mission details:', err);
        this.errorMessage = 'Failed to load mission details. Please try again.';
      }
    });
  }

  public parseDate(dateValue: string | number[] | Date | null): Date | null {
    if (!dateValue) return null;
    
    // If it's already a Date object
    if (dateValue instanceof Date) return dateValue;
    
    // If it's a string in array format
    if (typeof dateValue === 'string' && dateValue.includes(',')) {
      const parts = dateValue.split(',').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], parts[6]);
    }
    
    // If it's an array
    if (Array.isArray(dateValue)) {
      return new Date(
        dateValue[0],         // year
        dateValue[1] - 1,     // month (0-indexed)
        dateValue[2],         // day
        dateValue[3] || 0,    // hours
        dateValue[4] || 0,    // minutes
        dateValue[5] || 0,    // seconds
        dateValue[6] || 0     // milliseconds
      );
    }
    
    // Try to parse as ISO string
    try {
      return new Date(dateValue);
    } catch (e) {
      console.error('Failed to parse date:', dateValue);
      return null;
    }
  }
  

  
  startMission(missionId: string) {
    this.missionService.startMission(missionId).subscribe({
      next: () => {
        if (this.mission) {
          this.mission.status = 'IN_PROGRESS';
          this.mission.startTime = new Date().toISOString();
          this.mission.parsedStartTime = new Date();
          if (this.mission.deliveryRequest) {
            this.mission.deliveryRequest.status = 'IN_TRANSIT';
          }
          this.missionUpdated.emit(this.mission);
        }
      },
      error: (err) => {
        console.error('Failed to start mission', err);
        this.errorMessage = 'Failed to start mission. Please try again.';
      }
    });
  }
  
completeMission(missionId: string) {
  this.missionService.completeMission(missionId).subscribe({
    next: () => {
      if (this.mission) {
        this.mission.status = 'COMPLETED';
        this.mission.endTime = new Date().toISOString();
        this.mission.parsedEndTime = new Date();
        if (this.mission.deliveryRequest) {
          this.mission.deliveryRequest.status = 'DELIVERED';
        }
        
        // Show success message with countdown
        this.errorMessage = ''; // Clear any previous errors
        
        // Optional: Add a countdown timer for user feedback
        let countdown = 5;
        const countdownInterval = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            // You can show this message in the UI if needed
            console.log(`Mission completed! New assignments available in ${countdown} seconds...`);
          } else {
            clearInterval(countdownInterval);
            console.log('Mission completed successfully! You can now take new assignments.');
          }
        }, 1000);
        
        // Emit the updated mission immediately for UI update
        this.missionUpdated.emit(this.mission);
        
        // Add delay before allowing new assignments
        setTimeout(() => {
          // Additional logic here if needed
          console.log('New assignments are now available');
          
          // You could emit another event or update a flag here
          // For example: this.newAssignmentsAvailable.emit(true);
        }, 5000);
      }
    },
    error: (err) => {
      console.error('Failed to complete mission', err);
      this.errorMessage = 'Failed to complete mission. Please try again.';
    }
  });
}
  
  calculateDuration(start: Date | null | undefined, end: Date | null | undefined): string {
    if (!start || !end) return 'N/A';
    
    const startTime = start.getTime();
    const endTime = end.getTime();
    const durationMs = endTime - startTime;
    
    if (durationMs < 0) return 'Invalid duration';
    
    // Less than an hour
    if (durationMs < 3600000) {
      return Math.round(durationMs / 60000) + ' minutes';
    }
    
    // Less than a day
    if (durationMs < 86400000) {
      const hours = Math.floor(durationMs / 3600000);
      const minutes = Math.round((durationMs % 3600000) / 60000);
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    // More than a day
    const days = Math.floor(durationMs / 86400000);
    const hours = Math.round((durationMs % 86400000) / 3600000);
    return `${days} day${days !== 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  closeDialog() {
    // Clear mission data first
    this.mission = null;
    // Then emit the close event
    this.closeDialogEvent.emit();
  }
}