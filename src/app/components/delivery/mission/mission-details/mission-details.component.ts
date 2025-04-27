import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MissionService } from '../../../../services/mission-service.service';

@Component({
  selector: 'app-mission-details-dialog',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './mission-details.component.html',
  styleUrls: ['./mission-details.component.css']
})
export class MissionDetailsComponent implements OnInit {
  @Input() missionId: string = '';
  @Output() close = new EventEmitter<boolean>();
  @Output() missionUpdated = new EventEmitter<any>();
  
  mission: any;

  constructor(private missionService: MissionService) {}

  ngOnInit() {
    if (this.missionId) {
      this.loadMissionDetails();
    }
  }
  
  loadMissionDetails() {
    this.missionService.getMissionDetails(this.missionId).subscribe(mission => {
      this.mission = mission;
    });
  }

  closeDialog() {
    this.close.emit(true);
  }
  
  startMission(missionId: string) {
    this.missionService.startMission(missionId).subscribe(updatedMission => {
      this.mission = updatedMission;
      this.missionUpdated.emit(updatedMission);
    });
  }
  
  completeMission(missionId: string) {
    this.missionService.completeMission(missionId).subscribe(updatedMission => {
      this.mission = updatedMission;
      this.missionUpdated.emit(updatedMission);
    });
  }
  
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