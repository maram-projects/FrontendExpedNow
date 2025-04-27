// mission-dashboard.component.ts
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
  imports: [CommonModule, RouterModule, DatePipe, MissionDetailsComponent], // Add DatePipe here
  templateUrl: './mission-dashboard.component.html',
  styleUrls: ['./mission-dashboard.component.css']
})
export class MissionDashboardComponent implements OnInit {
  missions: any[] = [];
  currentUser: any;
  isLoading = true;
  errorMessage: string = ''; // أضف هذا السطر
  successMessage: string = ''; // إضافة اختيارية إذا كنت تحتاجها
  selectedMissionId: string | null = null;
  showMissionDialog = false;
  constructor(
    private missionService: MissionService,
    private authService: AuthService,
    private router: Router 
  ) {}
  
  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    console.log('Current User:', this.currentUser); // للتأكد من البيانات
    
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
    
    // تأكد أن الـ userId مش null أو undefined
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
          
          // تحديث حالة الطلب المرتبط
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
  
  completeMission(missionId: string) {
    this.missionService.completeMission(missionId).subscribe({
      next: () => {
        const missionIndex = this.missions.findIndex(m => m.id === missionId);
        if (missionIndex !== -1) {
          this.missions[missionIndex].status = 'COMPLETED';
          this.missions[missionIndex].endTime = new Date();
          this.successMessage = 'Mission completed successfully';
          
          // تحديث حالة الطلب المرتبط
          if (this.missions[missionIndex].deliveryRequest) {
            this.missions[missionIndex].deliveryRequest.status = 'DELIVERED';
          }
        }
      },
      error: (err) => {
        console.error('Failed to complete mission', err);
        this.errorMessage = err.error?.message || 'Failed to complete mission';
      }
    });
  }
  openMissionDetails(missionId: string) {
    this.selectedMissionId = missionId;
    this.showMissionDialog = true;
  }
  
  closeMissionDialog() {
    this.showMissionDialog = false;
    this.selectedMissionId = null;
  }
  
  onMissionUpdated(mission: any) {
    // Update the mission in your local list if needed
    const index = this.missions.findIndex(m => m.id === mission.id);
    if (index !== -1) {
      this.missions[index] = mission;
    }
  }
}