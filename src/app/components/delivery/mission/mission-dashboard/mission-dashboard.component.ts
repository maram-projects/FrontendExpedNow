import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MissionService } from '../../../../services/mission-service.service';
import { AuthService } from '../../../../services/auth.service';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MissionDetailsComponent } from "../mission-details/mission-details.component";

@Component({
  selector: 'app-mission-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe,MissionDetailsComponent  
    
  ],
  templateUrl: './mission-dashboard.component.html',
 styleUrls: ['./mission-dashboard.component.css'] 
})
export class MissionDashboardComponent implements OnInit {
  missions: any[] = [];
  currentUser: any;
  isLoading = true;
  errorMessage: string = '';
  successMessage: string = '';
  selectedMissionId: string | null = null;
  showMissionDialog = false;
  
  // Add view mode toggle property
  viewMode: 'cards' | 'table' = 'cards';
  
  constructor(
    private missionService: MissionService,
    private authService: AuthService,
    private router: Router 
  ) {}
  
  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    console.log('Current User:', this.currentUser);
    
    if (!this.currentUser?.userId) {
      console.error('User not authenticated or missing ID');
      this.errorMessage = 'Please login to view your missions';
      this.isLoading = false;
      this.router.navigate(['/login']);
      return;
    }
    
    this.loadMissions();
  }
  
  loadMissions() {
    this.isLoading = true;
    this.errorMessage = '';
    
    if (!this.currentUser?.userId) {
      this.errorMessage = 'User ID is missing';
      this.isLoading = false;
      return;
    }
  
    this.missionService.getDeliveryPersonMissions(this.currentUser.userId)
      .subscribe({
        next: (missions) => {
          this.missions = missions;
          this.isLoading = false;
        },
        error: (err) => {
          this.errorMessage = 'Failed to load missions. Please try again later.';
          this.isLoading = false;
          console.error('Error loading missions:', err);
        }
      });
  }
  
  startMission(missionId: string) {
    this.missionService.startMission(missionId).subscribe({
      next: () => {
        const missionIndex = this.missions.findIndex(m => m.id === missionId);
        if (missionIndex !== -1) {
          this.missions[missionIndex].status = 'IN_PROGRESS';
          this.successMessage = 'Mission started successfully';
          
          if (this.missions[missionIndex].deliveryRequest) {
            this.missions[missionIndex].deliveryRequest.status = 'IN_TRANSIT';
          }
        }
      },
      error: (err) => {
        console.error('Failed to start mission', err);
        this.errorMessage = err.error?.message || 'Failed to start mission';
      }
    });
  }

  // In your parent component
closeMissionDialog() {
  this.showMissionDialog = false;
  this.selectedMissionId = null; // This is important!
}
  
completeMission(missionId: string) {
  this.missionService.completeMission(missionId).subscribe({
    next: () => {
      const missionIndex = this.missions.findIndex(m => m.id === missionId);
      if (missionIndex !== -1) {
        this.missions[missionIndex].status = 'COMPLETED';
        this.missions[missionIndex].endTime = new Date();
        
        // Update delivery request status if exists
        if (this.missions[missionIndex].deliveryRequest) {
          this.missions[missionIndex].deliveryRequest.status = 'DELIVERED';
        }
      }
      
      // Show temporary message with countdown
      this.successMessage = 'Mission completed! New assignments available in 5 seconds...';
      this.errorMessage = ''; // Clear any previous errors
      
      // Optional: Add a countdown timer
      let countdown = 5;
      const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          this.successMessage = `Mission completed! New assignments available in ${countdown} seconds...`;
        } else {
          clearInterval(countdownInterval);
          this.successMessage = 'Mission completed successfully! You can now take new assignments.';
        }
      }, 1000);
      
      // Enable new assignments after delay
      setTimeout(() => {
        // Refresh the missions list to show updated data
        this.loadMissions();
        
        // Clear the success message after showing final message for a bit
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      }, 5000);
    },
    error: (err) => {
      console.error('Failed to complete mission', err);
      this.errorMessage = err.error?.message || 'Failed to complete mission';
      this.successMessage = ''; // Clear success message on error
    }
  });
}
  openMissionDetails(missionId: string) {
    this.selectedMissionId = missionId;
    this.showMissionDialog = true;
  }
  

  onMissionUpdated(mission: any) {
    const index = this.missions.findIndex(m => m.id === mission.id);
    if (index !== -1) {
      this.missions[index] = mission;
    }
  }
  
  // Add calculate duration method from MissionDetailsComponent
  calculateDuration(startTime: string, endTime: string): string {
    if (!startTime || !endTime) {
      return 'N/A';
    }
    
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationMs = end - start;
    
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
}