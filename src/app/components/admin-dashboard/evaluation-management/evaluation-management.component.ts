import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Chart, ChartConfiguration, ChartOptions } from 'chart.js/auto';
import { DeliveryService, DetailedRatingResponse } from '../../../services/delivery-service.service';
import { AuthService } from '../../../services/auth.service';
import { RatingDetailsModalComponent } from '../../client/rating-details-modal/rating-details-modal.component';
import { DatePipe } from '@angular/common';
import { environment } from '../../../../environments/environment';
interface EvaluationStats {
  totalRatings: number;
  averageRating: number;
  fiveStarCount: number;
  fourStarCount: number;
  threeStarCount: number;
  twoStarCount: number;
  oneStarCount: number;
  ratingsThisWeek: number;
  ratingsThisMonth: number;
  averageThisMonth: number;
  topPerformers: DeliveryPersonPerformance[];
  lowPerformers: DeliveryPersonPerformance[];
}

interface DeliveryPersonPerformance {
  id: string;
  name: string;
  email: string;
  totalRatings: number;
  averageRating: number;
  completedDeliveries: number;
  positiveRatings: number;
  negativeRatings: number;
}

@Component({
  selector: 'app-evaluation-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSortModule,
    MatTooltipModule,
    MatDividerModule,
    MatProgressBarModule
],
  templateUrl: './evaluation-management.component.html',
  styleUrls: ['./evaluation-management.component.css']
})
export class EvaluationManagementComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Data properties
  allRatings: DetailedRatingResponse[] = [];
  filteredRatings: DetailedRatingResponse[] = [];
  deliveryPersonPerformances: DeliveryPersonPerformance[] = [];
  evaluationStats: EvaluationStats = {
    totalRatings: 0,
    averageRating: 0,
    fiveStarCount: 0,
    fourStarCount: 0,
    threeStarCount: 0,
    twoStarCount: 0,
    oneStarCount: 0,
    ratingsThisWeek: 0,
    ratingsThisMonth: 0,
    averageThisMonth: 0,
    topPerformers: [],
    lowPerformers: []
  };

  // UI State
  isLoading = false;
  isPerformanceLoading = false;
  errorMessage = '';
  
  // Filters
  ratingFilter: 'all' | '5' | '4' | '3' | '2' | '1' = 'all';
  dateFilter: 'all' | 'today' | 'week' | 'month' | 'quarter' = 'all';
  deliveryPersonFilter = '';
  sortBy: 'date-desc' | 'date-asc' | 'rating-desc' | 'rating-asc' = 'date-desc';
  
  // Table setup
  dataSource = new MatTableDataSource<DetailedRatingResponse>([]);
  displayedColumns: string[] = ['deliveryId', 'deliveryPerson', 'client', 'overallRating', 'categories', 'ratedAt', 'actions'];
  
  // Performance table
  performanceDataSource = new MatTableDataSource<DeliveryPersonPerformance>([]);
  performanceColumns: string[] = ['name', 'totalRatings', 'averageRating', 'completedDeliveries', 'positiveRatings', 'actions'];
  
  // Charts
  ratingDistributionChart: Chart | null = null;
  monthlyTrendChart: Chart | null = null;

  constructor(
    private deliveryService: DeliveryService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loadAllRatings();
    this.loadDeliveryPersonPerformance();
  }




  calculateStats(): void {
    const ratings = this.allRatings;
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    this.evaluationStats = {
      totalRatings: ratings.length,
      averageRating: ratings.length > 0 ? 
        Math.round((ratings.reduce((sum, r) => sum + (r.overallRating || 0), 0) / ratings.length) * 10) / 10 : 0,
      fiveStarCount: ratings.filter(r => Math.round(r.overallRating) === 5).length,
      fourStarCount: ratings.filter(r => Math.round(r.overallRating) === 4).length,
      threeStarCount: ratings.filter(r => Math.round(r.overallRating) === 3).length,
      twoStarCount: ratings.filter(r => Math.round(r.overallRating) === 2).length,
      oneStarCount: ratings.filter(r => Math.round(r.overallRating) === 1).length,
      ratingsThisWeek: ratings.filter(r => r.ratedAt && new Date(r.ratedAt) >= oneWeekAgo).length,
      ratingsThisMonth: ratings.filter(r => r.ratedAt && new Date(r.ratedAt) >= oneMonthAgo).length,
      averageThisMonth: 0,
      topPerformers: [],
      lowPerformers: []
    };

    // Calculate average for this month
    const thisMonthRatings = ratings.filter(r => r.ratedAt && new Date(r.ratedAt) >= oneMonthAgo);
    if (thisMonthRatings.length > 0) {
      this.evaluationStats.averageThisMonth = Math.round(
        (thisMonthRatings.reduce((sum, r) => sum + (r.overallRating || 0), 0) / thisMonthRatings.length) * 10
      ) / 10;
    }
  }

  updateTopAndLowPerformers(): void {
    const sorted = [...this.deliveryPersonPerformances]
      .filter(p => p.totalRatings >= 5) // At least 5 ratings
      .sort((a, b) => b.averageRating - a.averageRating);
    
    this.evaluationStats.topPerformers = sorted.slice(0, 5);
    this.evaluationStats.lowPerformers = sorted.slice(-5).reverse();
  }

  applyFilters(): void {
    let filtered = [...this.allRatings];

    // Apply rating filter
    if (this.ratingFilter !== 'all') {
      const targetRating = parseInt(this.ratingFilter);
      filtered = filtered.filter(r => Math.round(r.overallRating) === targetRating);
    }

    // Apply date filter
    const now = new Date();
    switch (this.dateFilter) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filtered = filtered.filter(r => r.ratedAt && new Date(r.ratedAt) >= today);
        break;
      case 'week':
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(r => r.ratedAt && new Date(r.ratedAt) >= oneWeekAgo);
        break;
      case 'month':
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        filtered = filtered.filter(r => r.ratedAt && new Date(r.ratedAt) >= oneMonthAgo);
        break;
      case 'quarter':
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        filtered = filtered.filter(r => r.ratedAt && new Date(r.ratedAt) >= threeMonthsAgo);
        break;
    }

    // Apply delivery person filter
    if (this.deliveryPersonFilter) {
      filtered = filtered.filter(r => 
        r.deliveryPersonName?.toLowerCase().includes(this.deliveryPersonFilter.toLowerCase())
      );
    }

    this.filteredRatings = filtered;
    this.sortRatings();
    this.dataSource.data = this.filteredRatings;
  }

  sortRatings(): void {
    const [field, direction] = this.sortBy.split('-');
    
    this.filteredRatings.sort((a, b) => {
      let valueA: any, valueB: any;
      
      if (field === 'date') {
        valueA = a.ratedAt ? new Date(a.ratedAt).getTime() : 0;
        valueB = b.ratedAt ? new Date(b.ratedAt).getTime() : 0;
      } else if (field === 'rating') {
        valueA = a.overallRating || 0;
        valueB = b.overallRating || 0;
      }
      
      return direction === 'desc' ? valueB - valueA : valueA - valueB;
    });
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.ratingFilter = 'all';
    this.dateFilter = 'all';
    this.deliveryPersonFilter = '';
    this.sortBy = 'date-desc';
    this.applyFilters();
  }

  setupCharts(): void {
    setTimeout(() => {
      this.setupRatingDistributionChart();
      this.setupMonthlyTrendChart();
    }, 100);
  }

  setupRatingDistributionChart(): void {
    const canvas = document.getElementById('ratingDistributionChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.ratingDistributionChart) {
      this.ratingDistributionChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.ratingDistributionChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['5 Stars', '4 Stars', '3 Stars', '2 Stars', '1 Star'],
        datasets: [{
          data: [
            this.evaluationStats.fiveStarCount,
            this.evaluationStats.fourStarCount,
            this.evaluationStats.threeStarCount,
            this.evaluationStats.twoStarCount,
            this.evaluationStats.oneStarCount
          ],
          backgroundColor: [
            '#4CAF50',
            '#8BC34A',
            '#FFC107',
            '#FF9800',
            '#F44336'
          ],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  setupMonthlyTrendChart(): void {
    const canvas = document.getElementById('monthlyTrendChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.monthlyTrendChart) {
      this.monthlyTrendChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate last 6 months data
    const monthlyData = this.generateMonthlyTrendData();

    this.monthlyTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthlyData.labels,
        datasets: [
          {
            label: 'Average Rating',
            data: monthlyData.averageRatings,
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Number of Ratings',
            data: monthlyData.ratingCounts,
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            min: 0,
            max: 5
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    });
  }

  generateMonthlyTrendData(): any {
    const now = new Date();
    const labels: string[] = [];
    const averageRatings: number[] = [];
    const ratingCounts: number[] = [];

    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = targetDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      labels.push(monthName);

      const monthRatings = this.allRatings.filter(r => {
        if (!r.ratedAt) return false;
        const ratingDate = new Date(r.ratedAt);
        return ratingDate.getMonth() === targetDate.getMonth() && 
               ratingDate.getFullYear() === targetDate.getFullYear();
      });

      ratingCounts.push(monthRatings.length);
      
      if (monthRatings.length > 0) {
        const avg = monthRatings.reduce((sum, r) => sum + (r.overallRating || 0), 0) / monthRatings.length;
        averageRatings.push(Math.round(avg * 10) / 10);
      } else {
        averageRatings.push(0);
      }
    }

    return { labels, averageRatings, ratingCounts };
  }

  viewRatingDetails(rating: DetailedRatingResponse): void {
    const dialogRef = this.dialog.open(RatingDetailsModalComponent, {
      width: '650px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { ratingData: rating }
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('Rating details modal closed');
    });
  }

  viewDeliveryPersonProfile(deliveryPersonId: string): void {
    this.router.navigate(['/admin/DeliveryPersonnel', deliveryPersonId]);
  }

  exportEvaluations(): void {
    // Implement CSV export
    const csvData = this.convertToCSV(this.filteredRatings);
    this.downloadCSV(csvData, 'evaluations.csv');
    this.snackBar.open('Evaluations exported successfully', 'Close', { duration: 3000 });
  }

  exportPerformanceReport(): void {
    const csvData = this.convertPerformanceToCSV(this.deliveryPersonPerformances);
    this.downloadCSV(csvData, 'performance_report.csv');
    this.snackBar.open('Performance report exported successfully', 'Close', { duration: 3000 });
  }

  private convertToCSV(data: DetailedRatingResponse[]): string {
    const header = 'Delivery ID,Delivery Person,Client,Overall Rating,Punctuality,Professionalism,Package Condition,Communication,Comment,Rated At';
    const rows = data.map(r => [
      r.deliveryId,
      r.deliveryPersonName || '',
      r.clientName || '',
      r.overallRating,
      r.punctualityRating || '',
      r.professionalismRating || '',
      r.packageConditionRating || '',
      r.communicationRating || '',
      (r.comment || '').replace(/"/g, '""'),
      r.ratedAt
    ].join(','));
    
    return [header, ...rows].join('\n');
  }

  private convertPerformanceToCSV(data: DeliveryPersonPerformance[]): string {
    const header = 'Name,Email,Total Ratings,Average Rating,Completed Deliveries,Positive Ratings,Negative Ratings';
    const rows = data.map(p => [
      p.name,
      p.email,
      p.totalRatings,
      p.averageRating,
      p.completedDeliveries,
      p.positiveRatings,
      p.negativeRatings
    ].join(','));
    
    return [header, ...rows].join('\n');
  }

  private downloadCSV(csvData: string, filename: string): void {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  refreshData(): void {
    this.loadInitialData();
    this.snackBar.open('Data refreshed successfully', 'Close', { duration: 2000 });
  }

  getRatingStarArray(rating: number): number[] {
    return Array(5).fill(0).map((_, i) => i + 1);
  }

  getRatingPercentage(starCount: number): number {
    if (this.evaluationStats.totalRatings === 0) return 0;
    
    let count = 0;
    switch (starCount) {
      case 5: count = this.evaluationStats.fiveStarCount; break;
      case 4: count = this.evaluationStats.fourStarCount; break;
      case 3: count = this.evaluationStats.threeStarCount; break;
      case 2: count = this.evaluationStats.twoStarCount; break;
      case 1: count = this.evaluationStats.oneStarCount; break;
    }
    
    return Math.round((count / this.evaluationStats.totalRatings) * 100);
  }

  getPositiveRatingsPercentage(): number {
    if (this.evaluationStats.totalRatings === 0) return 0;
    const positiveRatings = this.evaluationStats.fiveStarCount + this.evaluationStats.fourStarCount;
    return Math.round((positiveRatings / this.evaluationStats.totalRatings) * 100);
  }

  formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Date invalide';
    }
  }

  getCategoryLabel(category: string): string {
    const labels: { [key: string]: string } = {
      'punctuality': 'Ponctualité',
      'professionalism': 'Professionnalisme',
      'package_condition': 'État du Colis',
      'communication': 'Communication'
    };
    return labels[category] || category;
  }

  trackByRatingId(index: number, rating: DetailedRatingResponse): string {
    return rating.id;
  }

  trackByPerformanceId(index: number, performance: DeliveryPersonPerformance): string {
    return performance.id;
  }

  // Add these debugging methods to your admin component

// 1. Add console logs in loadAllRatings method
loadAllRatings(): void {
  this.isLoading = true;
  this.errorMessage = '';
  
  console.log('🔍 Admin: Loading all ratings...');
  console.log('🔍 Admin: API URL will be:', `${environment.apiUrl}/api/deliveries/ratings/all`);
  console.log('🔍 Admin: Auth token exists:', !!this.authService.getToken());
  console.log('🔍 Admin: Current user:', this.authService.getCurrentUser());

  this.deliveryService.getAllRatings().subscribe({
    next: (ratings: DetailedRatingResponse[]) => {
      console.log('✅ Admin: Received ratings:', ratings);
      console.log('✅ Admin: Ratings count:', ratings.length);
      
      this.allRatings = ratings;
      this.calculateStats();
      this.applyFilters();
      this.setupCharts();
      this.isLoading = false;
    },
    error: (err) => {
      console.error('❌ Admin: Error loading ratings:', err);
      console.error('❌ Admin: Error status:', err.status);
      console.error('❌ Admin: Error message:', err.message);
      console.error('❌ Admin: Full error object:', err);
      
      this.errorMessage = 'Failed to load evaluation data';
      this.isLoading = false;
    }
  });
}

// 2. Add debugging to loadDeliveryPersonPerformance
loadDeliveryPersonPerformance(): void {
  this.isPerformanceLoading = true;
  
  console.log('🔍 Admin: Loading performance stats...');
  console.log('🔍 Admin: Performance API URL:', `${environment.apiUrl}/api/deliveries/performance/stats`);
  
  this.deliveryService.getDeliveryPersonPerformanceStats().subscribe({
    next: (performances: DeliveryPersonPerformance[]) => {
      console.log('✅ Admin: Received performance data:', performances);
      console.log('✅ Admin: Performance count:', performances.length);
      
      this.deliveryPersonPerformances = performances;
      this.performanceDataSource.data = performances;
      this.updateTopAndLowPerformers();
      this.isPerformanceLoading = false;
    },
    error: (err: any) => {
      console.error('❌ Admin: Error loading performance data:', err);
      console.error('❌ Admin: Performance error status:', err.status);
      console.error('❌ Admin: Performance error message:', err.message);
      
      this.isPerformanceLoading = false;
    }
  });
}

// 3. Add method to test individual delivery person ratings (for comparison)
testDeliveryPersonRatings(deliveryPersonId: string): void {
  console.log('🧪 Testing delivery person ratings for ID:', deliveryPersonId);
  
  this.deliveryService.getDeliveryPersonRatings(deliveryPersonId).subscribe({
    next: (ratings) => {
      console.log('✅ Test: Individual DP ratings:', ratings);
    },
    error: (err) => {
      console.error('❌ Test: Individual DP ratings error:', err);
    }
  });
}

// 4. Add method to check all service endpoints
testAllRatingEndpoints(): void {
  console.log('🧪 Testing all rating endpoints...');
  
  // Test 1: Get all ratings (admin)
  this.deliveryService.getAllRatings().subscribe({
    next: (ratings) => console.log('✅ getAllRatings works:', ratings.length, 'ratings'),
    error: (err) => console.error('❌ getAllRatings failed:', err.status, err.message)
  });
  
  // Test 2: Get performance stats
  this.deliveryService.getDeliveryPersonPerformanceStats().subscribe({
    next: (stats) => console.log('✅ getPerformanceStats works:', stats.length, 'records'),
    error: (err) => console.error('❌ getPerformanceStats failed:', err.status, err.message)
  });
  
  // Test 3: Get current user's ratings (if admin is also delivery person)
  const currentUser = this.authService.getCurrentUser();
  if (currentUser?.userId) {
    this.deliveryService.getDeliveryPersonRatings(currentUser.userId).subscribe({
      next: (ratings) => console.log('✅ getDeliveryPersonRatings for current user works:', ratings.length, 'ratings'),
      error: (err) => console.error('❌ getDeliveryPersonRatings failed:', err.status, err.message)
    });
  }
}

// 5. Add debugging button to your admin template
/*
Add this to your admin HTML template temporarily:

<button mat-raised-button color="warn" (click)="testAllRatingEndpoints()">
  🧪 Test All Endpoints
</button>

<button mat-raised-button color="accent" (click)="debugCurrentState()">
  🔍 Debug Current State
</button>
*/

debugCurrentState(): void {
  console.log('📊 Current Admin Dashboard State:');
  console.log('- All ratings:', this.allRatings);
  console.log('- Filtered ratings:', this.filteredRatings);
  console.log('- Performance data:', this.deliveryPersonPerformances);
  console.log('- Stats:', this.evaluationStats);
  console.log('- Is loading:', this.isLoading);
  console.log('- Error message:', this.errorMessage);
  console.log('- Current filters:', {
    rating: this.ratingFilter,
    date: this.dateFilter,
    deliveryPerson: this.deliveryPersonFilter
  });
}
}