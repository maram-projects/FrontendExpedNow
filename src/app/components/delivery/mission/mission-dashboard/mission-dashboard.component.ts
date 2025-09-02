import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { forkJoin } from 'rxjs';

// Import your services


// Import the mission details component (adjust path as needed)
import { MissionDetailsComponent } from '../mission-details/mission-details.component';
import { AuthService } from '../../../../services/auth.service';
import { BonusService } from '../../../../services/bonus.service';
import { MissionService } from '../../../../services/mission-service.service';

@Component({
  selector: 'app-mission-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DatePipe, MissionDetailsComponent],
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
  
  // Add mission statistics
  missionStats = {
    totalMissions: 0,
    completedMissions: 0,
    pendingMissions: 0,
    inProgressMissions: 0,
    progressToNextBonus: 0, // Progress to next 10-mission bonus
    nextBonusTarget: 10,
    completionRate: 0,
    averageDuration: 0
  };
  
  // Add bonus information
  recentBonuses: any[] = [];
  hasPendingBonuses = false;
  totalEarnings = 0;
  
  // Add view mode toggle property
  viewMode: 'cards' | 'table' = 'cards';
  
  // Add filters
  statusFilter: string = 'all';
  sortBy: string = 'startTime';
  sortOrder: 'asc' | 'desc' = 'desc';
  
  constructor(
    private missionService: MissionService,
    private bonusService: BonusService,
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
    
    this.loadDashboardData();
  }
  
  loadDashboardData() {
    this.isLoading = true;
    this.errorMessage = '';
    
    if (!this.currentUser?.userId) {
      this.errorMessage = 'User ID is missing';
      this.isLoading = false;
      return;
    }

    // Load missions and bonus data concurrently
    forkJoin({
      missions: this.missionService.getDeliveryPersonMissions(this.currentUser.userId),
      bonuses: this.bonusService.getDeliveryPersonBonuses(this.currentUser.userId)
    }).subscribe({
      next: (data: any) => {
        this.missions = data.missions || [];
        this.recentBonuses = (data.bonuses || []).slice(0, 5); // Get last 5 bonuses
        this.calculateMissionStats();
        this.checkPendingBonuses();
        this.calculateTotalEarnings();
        this.isLoading = false;
        console.log('Dashboard data loaded successfully');
      },
      error: (err: any) => {
        // Fallback to loading just missions if bonus service fails
        console.warn('Bonus service failed, loading missions only:', err);
        this.missionService.getDeliveryPersonMissions(this.currentUser.userId).subscribe({
          next: (missions: any) => {
            this.missions = missions || [];
            this.recentBonuses = [];
            this.calculateMissionStats();
            this.isLoading = false;
            console.log('Missions loaded successfully (without bonuses)');
          },
          error: (missionErr: any) => {
            this.errorMessage = 'Failed to load dashboard data. Please try again later.';
            this.isLoading = false;
            console.error('Error loading missions:', missionErr);
          }
        });
      }
    });
  }
  
  loadMissions() {
    this.loadDashboardData(); // Use the enhanced method
  }
  
  calculateMissionStats() {
    if (!this.missions || this.missions.length === 0) {
      this.missionStats = {
        totalMissions: 0,
        completedMissions: 0,
        pendingMissions: 0,
        inProgressMissions: 0,
        progressToNextBonus: 0,
        nextBonusTarget: 10,
        completionRate: 0,
        averageDuration: 0
      };
      return;
    }

    this.missionStats.totalMissions = this.missions.length;
    this.missionStats.completedMissions = this.missions.filter(m => m.status === 'COMPLETED').length;
    this.missionStats.pendingMissions = this.missions.filter(m => m.status === 'PENDING').length;
    this.missionStats.inProgressMissions = this.missions.filter(m => m.status === 'IN_PROGRESS').length;
    
    // Calculate completion rate
    this.missionStats.completionRate = this.missionStats.totalMissions > 0 
      ? (this.missionStats.completedMissions / this.missionStats.totalMissions) * 100 
      : 0;
    
    // Calculate average duration for completed missions
    const completedMissions = this.missions.filter(m => m.status === 'COMPLETED' && m.startTime && m.endTime);
    if (completedMissions.length > 0) {
      const totalDuration = completedMissions.reduce((sum, mission) => {
        const start = new Date(mission.startTime).getTime();
        const end = new Date(mission.endTime).getTime();
        return sum + (end - start);
      }, 0);
      this.missionStats.averageDuration = totalDuration / completedMissions.length;
    } else {
      this.missionStats.averageDuration = 0;
    }
    
    // Calculate progress to next bonus (every 10 completed missions)
    const completedCount = this.missionStats.completedMissions;
    const currentMilestone = Math.floor(completedCount / 10);
    const nextMilestone = (currentMilestone + 1) * 10;
    
    this.missionStats.progressToNextBonus = completedCount % 10;
    this.missionStats.nextBonusTarget = nextMilestone;
  }
  
checkPendingBonuses() {
  if (this.recentBonuses && this.recentBonuses.length > 0) {
    this.hasPendingBonuses = this.recentBonuses.some(bonus => bonus.status === 'CREATED');
  } else {
    this.hasPendingBonuses = false;
  }
}
  
  calculateTotalEarnings() {
    if (this.recentBonuses && this.recentBonuses.length > 0) {
      this.totalEarnings = this.recentBonuses
        .filter(bonus => bonus.status === 'PAID')
        .reduce((sum, bonus) => sum + (bonus.amount || 0), 0);
    } else {
      this.totalEarnings = 0;
    }
  }
  
  startMission(missionId: string) {
    this.missionService.startMission(missionId).subscribe({
      next: () => {
        const missionIndex = this.missions.findIndex(m => m.id === missionId);
        if (missionIndex !== -1) {
          this.missions[missionIndex].status = 'IN_PROGRESS';
          this.missions[missionIndex].startTime = new Date();
          this.successMessage = 'Mission started successfully';
          
          if (this.missions[missionIndex].deliveryRequest) {
            this.missions[missionIndex].deliveryRequest.status = 'IN_TRANSIT';
          }
          
          this.calculateMissionStats();
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            this.successMessage = '';
          }, 3000);
        }
      },
      error: (err: any) => {
        console.error('Failed to start mission', err);
        this.errorMessage = err.error?.message || 'Failed to start mission';
        setTimeout(() => {
          this.errorMessage = '';
        }, 5000);
      }
    });
  }

  closeMissionDialog() {
    this.showMissionDialog = false;
    this.selectedMissionId = null;
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
        
        // Recalculate stats
        this.calculateMissionStats();
        
        // Check if this completion triggers a milestone bonus
        const completedCount = this.missionStats.completedMissions;
        const isNewMilestone = completedCount % 10 === 0 && completedCount > 0;
        
        if (isNewMilestone) {
          this.successMessage = `🎉 Congratulations! Mission completed! You've reached ${completedCount} missions and earned a milestone bonus!`;
        } else {
          const remaining = 10 - (completedCount % 10);
          this.successMessage = `Mission completed! ${remaining} more mission${remaining !== 1 ? 's' : ''} until your next bonus milestone.`;
        }
        
        this.errorMessage = ''; // Clear any previous errors
        
        // Enable new assignments after delay
        setTimeout(() => {
          // Refresh the missions list to show updated data
          this.loadDashboardData();
          
          // Clear the success message after showing final message for a bit
          setTimeout(() => {
            this.successMessage = '';
          }, 5000);
        }, 3000);
      },
      error: (err: any) => {
        console.error('Failed to complete mission', err);
        this.errorMessage = err.error?.message || 'Failed to complete mission';
        this.successMessage = ''; // Clear success message on error
        setTimeout(() => {
          this.errorMessage = '';
        }, 5000);
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
      this.calculateMissionStats();
    }
  }
  
  // Filter and sort methods
  getFilteredMissions(): any[] {
    let filtered = this.missions;
    
    // Apply status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(mission => mission.status === this.statusFilter);
    }
    
    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue = a[this.sortBy];
      let bValue = b[this.sortBy];
      
      if (this.sortBy.includes('Time')) {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      if (this.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }
  
  // Calculate duration method from MissionDetailsComponent
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
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes > 0 ? ' ' + minutes + ' minute' + (minutes !== 1 ? 's' : '') : ''}`;
    }
    
    // More than a day
    const days = Math.floor(durationMs / 86400000);
    const hours = Math.round((durationMs % 86400000) / 3600000);
    return `${days} day${days !== 1 ? 's' : ''} ${hours > 0 ? ' ' + hours + ' hour' + (hours !== 1 ? 's' : '') : ''}`;
  }
  
  getAverageDurationText(): string {
    if (this.missionStats.averageDuration === 0) {
      return 'N/A';
    }
    return this.calculateDuration('0', this.missionStats.averageDuration.toString());
  }
  
  // Helper methods for template
  getMissionStatusIcon(status: string): string {
    switch (status) {
      case 'PENDING': return 'fas fa-clock text-warning';
      case 'IN_PROGRESS': return 'fas fa-truck text-primary';
      case 'COMPLETED': return 'fas fa-check-circle text-success';
      case 'CANCELLED': return 'fas fa-times-circle text-danger';
      default: return 'fas fa-question-circle text-muted';
    }
  }
  
  getMissionStatusText(status: string): string {
    switch (status) {
      case 'PENDING': return 'Pending';
      case 'IN_PROGRESS': return 'In Progress';
      case 'COMPLETED': return 'Completed';
      case 'CANCELLED': return 'Cancelled';
      default: return 'Unknown';
    }
  }
  
  getBonusStatusClass(status: string): string {
    switch (status) {
      case 'CREATED': return 'badge bg-info text-white';
      case 'PAID': return 'badge bg-success text-white';
      case 'REJECTED': return 'badge bg-danger text-white';
      default: return 'badge bg-secondary text-white';
    }
  }
  
  getBonusProgressPercentage(): number {
    return (this.missionStats.progressToNextBonus / 10) * 100;
  }
  
  // Format currency
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
  
  // Refresh dashboard
  refreshDashboard() {
    this.loadDashboardData();
  }
  
  // Export methods for future use
  canStartMission(mission: any): boolean {
    return mission.status === 'PENDING';
  }
  
  canCompleteMission(mission: any): boolean {
    return mission.status === 'IN_PROGRESS';
  }
  
  isMissionActive(mission: any): boolean {
    return mission.status === 'PENDING' || mission.status === 'IN_PROGRESS';
  }
}