import { Component, OnInit } from '@angular/core';
import { BonusService } from '../../../services/bonus.service';
import { Bonus, BonusStatus } from '../../../models/bonus.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ShortenPipe } from '../../../pipes/shorten.pipe';

@Component({
  selector: 'app-admin-bonuses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ShortenPipe],
  templateUrl: './admin-bonuses.component.html',
  styleUrls: ['./admin-bonuses.component.css']
})
export class AdminBonusesComponent implements OnInit {
  bonuses: Bonus[] = [];
  filteredBonuses: Bonus[] = []; // Add this to store filtered results
  selectedStatus: BonusStatus | 'ALL' = 'ALL';
  searchTerm: string = '';
  // Add BonusStatus to the component so it's accessible in the template
  BonusStatus = BonusStatus;

  constructor(private bonusService: BonusService) {}

  ngOnInit(): void {
    this.loadBonuses();
  }

  loadBonuses(): void {
    this.bonusService.getAllBonuses().subscribe({
      next: (bonuses) => {
        this.bonuses = bonuses;
        this.filterBonuses(); // Update filtered results
      },
      error: (err) => console.error('Error loading bonuses:', err)
    });
  }

  // Modified to return Bonus[] and store results in filteredBonuses
  filterBonuses(): Bonus[] {
    let filtered = [...this.bonuses];
    
    if (this.selectedStatus !== 'ALL') {
      filtered = filtered.filter(b => b.status === this.selectedStatus);
    }
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.deliveryPersonId.toLowerCase().includes(term) ||
        b.id.toLowerCase().includes(term)
      );
    }
    
    this.filteredBonuses = filtered;
    return this.filteredBonuses;
  }

  // Helper method to get enum values as array for the template
  getEnumValues(enumObj: any): string[] {
    return Object.keys(enumObj).filter(key => isNaN(Number(key)));
  }

  approveBonus(bonusId: string): void {
    this.bonusService.approveBonus(bonusId).subscribe({
      next: (updatedBonus) => {
        const index = this.bonuses.findIndex(b => b.id === bonusId);
        if (index !== -1) {
          this.bonuses[index] = updatedBonus;
          this.filterBonuses(); // Update filtered results
        }
      },
      error: (err) => console.error('Error approving bonus:', err)
    });
  }

  payBonus(bonusId: string): void {
    this.bonusService.payBonus(bonusId).subscribe({
      next: (updatedBonus) => {
        const index = this.bonuses.findIndex(b => b.id === bonusId);
        if (index !== -1) {
          this.bonuses[index] = updatedBonus;
          this.filterBonuses(); // Update filtered results
        }
      },
      error: (err) => console.error('Error paying bonus:', err)
    });
  }

  getStatusClass(status: BonusStatus): string {
    switch (status) {
      case BonusStatus.PENDING: return 'badge bg-warning';
      case BonusStatus.APPROVED: return 'badge bg-info';
      case BonusStatus.PAID: return 'badge bg-success';
      case BonusStatus.REJECTED: return 'badge bg-danger';
      default: return 'badge bg-secondary';
    }
  }
}
