// delivery-management.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AvailabilityService } from '../../../services/availability.service';
import { DeliveryRequest, DeliveryService, DeliveryStatus } from '../../../services/delivery-service.service';
import { MissionService } from '../../../services/mission-service.service';
import { UserService } from '../../../services/user.service';
import { VehicleService } from '../../../services/vehicle-service.service';


@Component({
  selector: 'app-delivery-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './delivery-management.component.html',
  styleUrls: ['./delivery-management.component.css']
})
export class DeliveryManagementComponent implements OnInit {
  deliveries: DeliveryRequest[] = [];
  filteredDeliveries: DeliveryRequest[] = [];
  selectedDelivery: DeliveryRequest | null = null;
  deliveryStats: any = {};
  isLoading = true;
  errorMessage = '';
  
  // Filtres
  statusFilter: string = 'all';
  searchTerm: string = '';
  dateFilter: string = '';
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  constructor(
    private deliveryService: DeliveryService,
    private missionService: MissionService,
    private userService: UserService,
    private vehicleService: VehicleService,
    private availabilityService: AvailabilityService
  ) {}

  ngOnInit(): void {
    this.loadDeliveries();
    this.calculateStats();
  }

  loadDeliveries(): void {
    this.isLoading = true;
    this.deliveryService.getAllDeliveries().subscribe({
      next: (deliveries) => {
        this.deliveries = deliveries;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Erreur lors du chargement des livraisons: ' + error.message;
        this.isLoading = false;
        console.error('Error loading deliveries:', error);
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.deliveries];
    
    // Filtre par statut
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === this.statusFilter);
    }
    
    // Filtre par recherche
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(d => 
        d.pickupAddress.toLowerCase().includes(term) ||
        d.deliveryAddress.toLowerCase().includes(term) ||
        d.packageDescription.toLowerCase().includes(term) ||
        (d.clientId && d.clientId.toLowerCase().includes(term)) ||
        (d.deliveryPersonId && d.deliveryPersonId.toLowerCase().includes(term))
      );
    }
    
    // Filtre par date
    if (this.dateFilter) {
      const filterDate = new Date(this.dateFilter);
      filtered = filtered.filter(d => {
        if (!d.createdAt) return false;
        const deliveryDate = new Date(d.createdAt);
        return deliveryDate.toDateString() === filterDate.toDateString();
      });
    }
    
    this.filteredDeliveries = filtered;
    this.totalPages = Math.ceil(this.filteredDeliveries.length / this.itemsPerPage);
    this.currentPage = 1; // Reset to first page after filtering
  }

  calculateStats(): void {
    this.deliveryStats = {
      total: this.deliveries.length,
      pending: this.deliveries.filter(d => d.status === DeliveryStatus.PENDING).length,
      assigned: this.deliveries.filter(d => d.status === DeliveryStatus.ASSIGNED).length,
      inTransit: this.deliveries.filter(d => d.status === DeliveryStatus.IN_TRANSIT).length,
      delivered: this.deliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length,
      cancelled: this.deliveries.filter(d => d.status === DeliveryStatus.CANCELLED).length
    };
  }

  selectDelivery(delivery: DeliveryRequest): void {
    this.selectedDelivery = delivery;
  }

  clearSelection(): void {
    this.selectedDelivery = null;
  }

  changeDeliveryStatus(deliveryId: string, newStatus: string): void {
    this.deliveryService.updateDeliveryStatus(deliveryId, newStatus).subscribe({
      next: () => {
        this.loadDeliveries(); // Recharger les données
        this.calculateStats();
        this.clearSelection();
      },
      error: (error) => {
        this.errorMessage = 'Erreur lors de la mise à jour du statut: ' + error.message;
        console.error('Error updating status:', error);
      }
    });
  }

  cancelDelivery(deliveryId: string): void {
    if (confirm('Êtes-vous sûr de vouloir annuler cette livraison?')) {
      this.deliveryService.adminCancelDelivery(deliveryId).subscribe({
        next: () => {
          this.loadDeliveries();
          this.calculateStats();
          this.clearSelection();
        },
        error: (error) => {
          this.errorMessage = 'Erreur lors de l\'annulation: ' + error.message;
          console.error('Error canceling delivery:', error);
        }
      });
    }
  }

  assignDelivery(deliveryId: string): void {
    this.deliveryService.assignDelivery(deliveryId).subscribe({
      next: () => {
        this.loadDeliveries();
        this.calculateStats();
      },
      error: (error) => {
        this.errorMessage = 'Erreur lors de l\'assignation: ' + error.message;
        console.error('Error assigning delivery:', error);
      }
    });
  }

  expireOldDeliveries(): void {
    if (confirm('Êtes-vous sûr de vouloir expirer les anciennes livraisons?')) {
      this.deliveryService.expireOldDeliveries().subscribe({
        next: () => {
          this.loadDeliveries();
          this.calculateStats();
          alert('Livraisons expirées avec succès');
        },
        error: (error) => {
          this.errorMessage = 'Erreur lors de l\'expiration: ' + error.message;
          console.error('Error expiring deliveries:', error);
        }
      });
    }
  }

  // Pagination methods
  get paginatedDeliveries(): DeliveryRequest[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredDeliveries.slice(startIndex, startIndex + this.itemsPerPage);
  }

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

  getStatusClass(status: string): string {
    switch (status) {
      case DeliveryStatus.PENDING: return 'status-pending';
      case DeliveryStatus.ASSIGNED: return 'status-assigned';
      case DeliveryStatus.APPROVED: return 'status-approved';
      case DeliveryStatus.IN_TRANSIT: return 'status-in-transit';
      case DeliveryStatus.DELIVERED: return 'status-delivered';
      case DeliveryStatus.CANCELLED: return 'status-cancelled';
      default: return 'status-unknown';
    }
  }
}