// mission-management.component.ts - Fixed without duplicate methods
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MissionService } from '../../../services/mission-service.service';
import { UserService } from '../../../services/user.service';
import { Mission } from '../../../models/mission.model';
import { User } from '../../../models/user.model';

@Component({
  selector: 'app-mission-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mission-management.component.html',
  styleUrls: ['./mission-management.component.css']
})
export class MissionManagementComponent implements OnInit {
  missions: Mission[] = [];
  filteredMissions: Mission[] = [];
  selectedMission: Mission | null = null;
  deliveryPersonnel: User[] = [];
  missionStats: any = {};
  isLoading = true;
  errorMessage = '';
  successMessage = '';
  
  // Debug information
  debugInfo: string = '';
  
  // Filters
  statusFilter: string = 'all';
  deliveryPersonFilter: string = 'all';
  searchTerm: string = '';
  dateFilter: string = '';
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  
  // Modal states - Only for viewing details
  showDetailsModal = false;
  
  // Admin permissions - read-only mode
  readonly isReadOnlyMode = true;

  constructor(
    private missionService: MissionService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    console.log('MissionManagementComponent initialized');
    this.loadMissions();
    this.loadDeliveryPersonnel();
    this.loadMissionStatistics();
  }

  loadMissions(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    console.log('Loading missions...');
    
    // Try multiple approaches to get missions
    this.missionService.getAllMissions().subscribe({
      next: (missions: Mission[]) => {
        console.log('Successfully loaded missions:', missions);
        console.log('Number of missions:', missions.length);
        
        this.missions = missions || [];
        this.debugInfo = `Loaded ${this.missions.length} missions from /api/missions/all`;
        
        if (this.missions.length === 0) {
          console.warn('No missions returned from API');
          // Try alternative endpoint
          this.tryAlternativeEndpoints();
        } else {
          this.applyFilters();
          this.calculateStats();
          this.isLoading = false;
        }
      },
      error: (error: any) => {
        console.error('Error loading missions from /all endpoint:', error);
        this.debugInfo = `Error from /all endpoint: ${error.message}`;
        
        // Try alternative endpoints
        this.tryAlternativeEndpoints();
      }
    });
  }

  // Try alternative endpoints if main one fails
  private tryAlternativeEndpoints(): void {
    console.log('Trying alternative endpoints...');
    
    // Try active missions endpoint
    this.missionService.getActiveMissions().subscribe({
      next: (missions: Mission[]) => {
        console.log('Loaded missions from active endpoint:', missions);
        this.missions = missions || [];
        this.debugInfo += ` | Fallback: loaded ${this.missions.length} active missions`;
        
        if (this.missions.length === 0) {
          // Try with client info endpoint
          this.tryClientInfoEndpoint();
        } else {
          this.applyFilters();
          this.calculateStats();
          this.isLoading = false;
        }
      },
      error: (error: any) => {
        console.error('Error loading active missions:', error);
        this.tryClientInfoEndpoint();
      }
    });
  }

  private tryClientInfoEndpoint(): void {
    console.log('Trying client info endpoint...');
    
    this.missionService.getAllMissionsWithClientInfo().subscribe({
      next: (missions: Mission[]) => {
        console.log('Loaded missions with client info:', missions);
        this.missions = missions || [];
        this.debugInfo += ` | Client info: ${this.missions.length} missions`;
        this.applyFilters();
        this.calculateStats();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('All mission endpoints failed:', error);
        this.errorMessage = 'Unable to load missions from any endpoint. Please check if the backend is running and endpoints are available.';
        this.debugInfo += ` | All endpoints failed: ${error.message}`;
        this.isLoading = false;
      }
    });
  }

  loadDeliveryPersonnel(): void {
    this.userService.getDeliveryPersonnel().subscribe({
      next: (personnel: User[]) => {
        console.log('Loaded delivery personnel:', personnel);
        this.deliveryPersonnel = personnel || [];
      },
      error: (error: any) => {
        console.error('Error loading delivery personnel:', error);
        this.deliveryPersonnel = [];
      }
    });
  }

  loadMissionStatistics(): void {
    this.missionService.getMissionStatistics().subscribe({
      next: (stats: any) => {
        console.log('Loaded mission statistics:', stats);
        this.missionStats = stats || {};
      },
      error: (error: any) => {
        console.warn('Statistics endpoint not available, calculating locally:', error);
        this.calculateStats();
      }
    });
  }

  calculateStats(): void {
    console.log('Calculating stats from missions:', this.missions);
    
    this.missionStats = {
      total: this.missions.length,
      pending: this.missions.filter(m => m.status === 'PENDING').length,
      inProgress: this.missions.filter(m => m.status === 'IN_PROGRESS').length,
      completed: this.missions.filter(m => m.status === 'COMPLETED').length,
      cancelled: this.missions.filter(m => m.status === 'CANCELLED').length,
      averageDuration: this.calculateAverageDuration()
    };
    
    console.log('Calculated stats:', this.missionStats);
  }

  calculateAverageDuration(): number {
    const completedMissions = this.missions.filter(m => 
      m.status === 'COMPLETED' && m.startTime && m.endTime
    );
    
    if (completedMissions.length === 0) return 0;
    
    const totalDuration = completedMissions.reduce((sum, mission) => {
      const viewModel = this.missionService.convertToViewModel(mission);
      const startTime = viewModel.parsedStartTime;
      const endTime = viewModel.parsedEndTime;
      
      if (startTime && endTime) {
        return sum + (endTime.getTime() - startTime.getTime());
      }
      return sum;
    }, 0);
    
    const validMissions = completedMissions.filter(m => {
      const viewModel = this.missionService.convertToViewModel(m);
      return viewModel.parsedStartTime && viewModel.parsedEndTime;
    });
    
    return validMissions.length > 0 ? totalDuration / validMissions.length : 0;
  }

  applyFilters(): void {
    console.log('Applying filters to missions:', this.missions.length);
    
    let filtered = [...this.missions];
    
    // Status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(m => m.status === this.statusFilter);
    }
    
    // Delivery person filter
    if (this.deliveryPersonFilter !== 'all') {
      filtered = filtered.filter(m => m.deliveryPersonId === this.deliveryPersonFilter);
    }
    
    // Search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(m => 
        m.id.toLowerCase().includes(term) ||
        this.getDeliveryPersonName(m).toLowerCase().includes(term) ||
        this.getClientName(m).toLowerCase().includes(term) ||
        this.getClientEmail(m).toLowerCase().includes(term) ||
        (m.deliveryRequest?.packageDescription && m.deliveryRequest.packageDescription.toLowerCase().includes(term)) ||
        (m.notes && m.notes.toLowerCase().includes(term))
      );
    }
    
    // Date filter
    if (this.dateFilter) {
      const filterDate = new Date(this.dateFilter);
      filtered = filtered.filter(m => {
        if (!m.assignedAt) return false;
        const missionDate = new Date(m.assignedAt);
        return missionDate.toDateString() === filterDate.toDateString();
      });
    }
    
    this.filteredMissions = filtered;
    this.calculatePagination();
    
    console.log('Filtered missions:', this.filteredMissions.length);
  }

  // Helper method to get delivery person name
  getDeliveryPersonName(mission: Mission): string {
    if (mission.deliveryPerson?.firstName && mission.deliveryPerson?.lastName) {
      return `${mission.deliveryPerson.firstName} ${mission.deliveryPerson.lastName}`;
    }
    
    if (mission.deliveryPerson?.name) {
      return mission.deliveryPerson.name;
    }
    
    // Fallback: try to find in deliveryPersonnel array
    const person = this.deliveryPersonnel.find(p => p.id === mission.deliveryPersonId);
    if (person) {
      return `${person.firstName} ${person.lastName}`;
    }
    
    return 'Unknown';
  }

  // Helper method to parse client info from notes
  private parseClientFromNotes(notes: string | undefined): {name?: string, email?: string} {
    if (!notes) return {};
    
    const clientInfo: {name?: string, email?: string} = {};
    
    // Look for patterns like "Client: client entr (cliententyyy@gmail.com)"
    const clientMatch = notes.match(/Client:\s*([^(]+)\s*\(([^)]+)\)/);
    if (clientMatch) {
      clientInfo.name = clientMatch[1].trim();
      clientInfo.email = clientMatch[2].trim();
      return clientInfo;
    }
    
    // Look for email patterns
    const emailMatch = notes.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      clientInfo.email = emailMatch[1];
    }
    
    // Look for name patterns (text before email or after "Client:")
    const nameMatch = notes.match(/Client:\s*([^(]+)/);
    if (nameMatch) {
      clientInfo.name = nameMatch[1].trim();
    }
    
    return clientInfo;
  }

  // Get client name (single implementation with notes parsing)
  getClientName(mission: Mission): string {
    console.log('=== Getting client name for mission:', mission.id, '===');
    console.log('Mission notes:', mission.notes);
    
    // First try structured data
    if (mission.client?.firstName && mission.client?.lastName) {
      console.log('✓ Found client at mission.client level:', mission.client);
      return `${mission.client.firstName} ${mission.client.lastName}`;
    }
    
    if (mission.deliveryRequest?.client?.firstName && mission.deliveryRequest?.client?.lastName) {
      console.log('✓ Found client at deliveryRequest.client level:', mission.deliveryRequest.client);
      return `${mission.deliveryRequest.client.firstName} ${mission.deliveryRequest.client.lastName}`;
    }
    
    // Try to extract from notes
    if (mission.notes) {
      const clientFromNotes = this.parseClientFromNotes(mission.notes);
      if (clientFromNotes.name) {
        console.log('✓ Found client name in notes:', clientFromNotes.name);
        return clientFromNotes.name;
      }
    }
    
    // Check for other possible locations using type assertion
    const anyMission = mission as any;
    if (anyMission.clientName) {
      console.log('✓ Found clientName directly on mission:', anyMission.clientName);
      return anyMission.clientName;
    }
    
    if (anyMission.client_name) {
      console.log('✓ Found client_name directly on mission:', anyMission.client_name);
      return anyMission.client_name;
    }
    
    // Check if there's a name property in the actual data (even though not in interface)
    if ((mission.client as any)?.name) {
      console.log('✓ Found name property at mission.client level:', (mission.client as any).name);
      return (mission.client as any).name;
    }
    
    if ((mission.deliveryRequest?.client as any)?.name) {
      console.log('✓ Found name property at deliveryRequest.client level:', (mission.deliveryRequest.client as any).name);
      return (mission.deliveryRequest.client as any).name;
    }
    
    console.log('✗ No client name found anywhere, returning Unknown Client');
    return 'Unknown Client';
  }

  // Get client email (single implementation with notes parsing)
  getClientEmail(mission: Mission): string {
    console.log('=== Getting client email for mission:', mission.id, '===');
    
    // First try structured data
    if (mission.client?.email) {
      console.log('✓ Found email at mission.client level:', mission.client.email);
      return mission.client.email;
    }
    
    if (mission.deliveryRequest?.client?.email) {
      console.log('✓ Found email at deliveryRequest.client level:', mission.deliveryRequest.client.email);
      return mission.deliveryRequest.client.email;
    }
    
    // Try to extract from notes
    if (mission.notes) {
      const clientFromNotes = this.parseClientFromNotes(mission.notes);
      if (clientFromNotes.email) {
        console.log('✓ Found client email in notes:', clientFromNotes.email);
        return clientFromNotes.email;
      }
    }
    
    // Check for other possible locations
    const anyMission = mission as any;
    if (anyMission.clientEmail) {
      console.log('✓ Found clientEmail directly on mission:', anyMission.clientEmail);
      return anyMission.clientEmail;
    }
    
    if (anyMission.client_email) {
      console.log('✓ Found client_email directly on mission:', anyMission.client_email);
      return anyMission.client_email;
    }
    
    console.log('✗ No client email found anywhere');
    return '';
  }

  // Get client phone (single implementation with phone parsing)
  getClientPhone(mission: Mission): string {
    console.log('=== Getting client phone for mission:', mission.id, '===');
    
    // First try structured data
    if (mission.client?.phone) {
      console.log('✓ Found phone at mission.client level:', mission.client.phone);
      return mission.client.phone;
    }
    
    if (mission.deliveryRequest?.client?.phone) {
      console.log('✓ Found phone at deliveryRequest.client level:', mission.deliveryRequest.client.phone);
      return mission.deliveryRequest.client.phone;
    }
    
    // Try to extract from notes (add phone pattern if needed)
    if (mission.notes) {
      // Look for phone patterns like +216 XX XXX XXX or similar
      const phoneMatch = mission.notes.match(/(\+?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,4})/);
      if (phoneMatch) {
        console.log('✓ Found phone in notes:', phoneMatch[1]);
        return phoneMatch[1].trim();
      }
    }
    
    // Check for other possible locations
    const anyMission = mission as any;
    if (anyMission.clientPhone) {
      console.log('✓ Found clientPhone directly on mission:', anyMission.clientPhone);
      return anyMission.clientPhone;
    }
    
    if (anyMission.client_phone) {
      console.log('✓ Found client_phone directly on mission:', anyMission.client_phone);
      return anyMission.client_phone;
    }
    
    console.log('✗ No client phone found anywhere');
    return '';
  }

  // Calculate pagination
  calculatePagination(): void {
    this.totalPages = Math.ceil(this.filteredMissions.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }
  }

  // Get paginated missions
  getPaginatedMissions(): Mission[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredMissions.slice(startIndex, endIndex);
  }

  // Pagination methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  // Clear filters
  clearFilters(): void {
    this.statusFilter = 'all';
    this.deliveryPersonFilter = 'all';
    this.searchTerm = '';
    this.dateFilter = '';
    this.applyFilters();
  }

  // View mission details
  viewMissionDetails(mission: Mission): void {
    console.log('Opening mission details for:', mission.id);
    this.debugMissionData(mission);
    this.selectedMission = mission;
    this.showDetailsModal = true;
  }

  debugMissionData(mission: Mission): void {
    console.log('=== DEBUG MISSION DATA ===');
    console.log('Full mission object:', mission);
    console.log('mission.client:', mission.client);
    console.log('mission.deliveryRequest:', mission.deliveryRequest);
    console.log('mission.deliveryRequest?.client:', mission.deliveryRequest?.client);
    console.log('=== END DEBUG ===');
  }

  // Close modals
  closeModal(): void {
    this.showDetailsModal = false;
    this.selectedMission = null;
  }

  // Get status badge class
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'badge-warning';
      case 'IN_PROGRESS':
        return 'badge-info';
      case 'COMPLETED':
        return 'badge-success';
      case 'CANCELLED':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }

  // Format date helper
  formatDate(dateValue: any): string {
    if (!dateValue) return 'N/A';
    
    try {
      // Use the mission service to parse the date
      const mission = { startTime: dateValue } as Mission;
      const viewModel = this.missionService.convertToViewModel(mission);
      const parsedDate = viewModel.parsedStartTime;
      
      if (parsedDate) {
        return parsedDate.toLocaleString();
      }
      
      // Fallback: try direct conversion
      const date = new Date(dateValue);
      return date.toLocaleString();
    } catch (error) {
      console.error('Error formatting date:', dateValue, error);
      return 'Invalid Date';
    }
  }

  // Format duration helper
  formatDuration(durationMs: number): string {
    if (!durationMs || durationMs <= 0) return 'N/A';
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // Refresh data
  refreshData(): void {
    this.loadMissions();
    this.loadDeliveryPersonnel();
    this.loadMissionStatistics();
  }

  // Export missions (placeholder)
  exportMissions(): void {
    console.log('Exporting missions...', this.filteredMissions);
    // Implementation would depend on export format needed
    alert('Export functionality would be implemented here');
  }

  // Clear messages
  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  // Additional methods needed by the template
  
  // Show debug info method
  showDebugInfo(): void {
    if (!this.debugInfo) {
      this.debugInfo = `Component Status:
        - Missions loaded: ${this.missions.length}
        - Filtered missions: ${this.filteredMissions.length}
        - Delivery personnel: ${this.deliveryPersonnel.length}
        - Current page: ${this.currentPage}
        - Total pages: ${this.totalPages}
        - Loading state: ${this.isLoading}
        - Stats: ${JSON.stringify(this.missionStats)}`;
    } else {
      this.debugInfo = '';
    }
  }

  // Export missions data method
  exportMissionsData(): void {
    this.exportMissions(); // Call existing export method
  }

  // Get paginated missions property
  get paginatedMissions(): Mission[] {
    return this.getPaginatedMissions();
  }

  // Select mission method
  selectMission(mission: Mission): void {
    this.selectedMission = mission;
  }

  // Clear selection method
  clearSelection(): void {
    this.selectedMission = null;
  }

  // Get status CSS class
  getStatusClass(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'status-pending';
      case 'IN_PROGRESS':
        return 'status-in-progress';
      case 'COMPLETED':
        return 'status-completed';
      case 'CANCELLED':
        return 'status-cancelled';
      default:
        return 'status-unknown';
    }
  }

  // Get status icon
  getStatusIcon(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'fas fa-clock';
      case 'IN_PROGRESS':
        return 'fas fa-truck';
      case 'COMPLETED':
        return 'fas fa-check-circle';
      case 'CANCELLED':
        return 'fas fa-times-circle';
      default:
        return 'fas fa-question-circle';
    }
  }

  // Get mission duration
  getMissionDuration(mission: Mission): string {
    if (!mission.startTime || !mission.endTime) {
      return 'N/A';
    }

    const viewModel = this.missionService.convertToViewModel(mission);
    const startTime = viewModel.parsedStartTime;
    const endTime = viewModel.parsedEndTime;

    if (startTime && endTime) {
      const durationMs = endTime.getTime() - startTime.getTime();
      return this.formatDuration(durationMs);
    }

    return 'N/A';
  }

  // Get mission start date
  getMissionStartDate(mission: Mission): string {
    if (!mission.startTime) return 'N/A';
    
    const viewModel = this.missionService.convertToViewModel(mission);
    const startDate = viewModel.parsedStartTime;
    
    return startDate ? startDate.toLocaleString() : 'N/A';
  }

  // Get mission end date
  getMissionEndDate(mission: Mission): string {
    if (!mission.endTime) return 'N/A';
    
    const viewModel = this.missionService.convertToViewModel(mission);
    const endDate = viewModel.parsedEndTime;
    
    return endDate ? endDate.toLocaleString() : 'N/A';
  }

  // Get client ID
  getClientId(mission: Mission): string {
    // Check mission level client info first
    if (mission.client?.id) {
      return mission.client.id;
    }
    
    // Check delivery request client info
    if (mission.deliveryRequest?.client?.id) {
      return mission.deliveryRequest.client.id;
    }
    
    // Fallback to clientId if exists
    if (mission.deliveryRequest?.clientId) {
      return mission.deliveryRequest.clientId;
    }
    
    return 'Unknown';
  }

  // Close details modal
  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedMission = null;
  }

  // Make Math available to template
  Math = Math;

  // Safe method to get truncated mission ID
  getTruncatedMissionId(mission: Mission | null): string {
    if (!mission || !mission.id) {
      return 'N/A';
    }
    return mission.id.substring(0, 12);
  }
}