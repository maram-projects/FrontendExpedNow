// rating-details-modal.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface DetailedRatingResponse {
  id: string;
  deliveryId: string;
  deliveryAddress: string;
  overallRating: number;
  ratingType: 'overall' | 'delivery_person' | 'service';
  categories: string[];
  punctualityRating?: number;
  professionalismRating?: number;
  packageConditionRating?: number;
  communicationRating?: number;
  comment?: string;
  wouldRecommend?: boolean;
  ratedAt: string;
}

@Component({
  selector: 'app-rating-details-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="rating-details-modal">
      <!-- Header -->
      <div class="modal-header">
        <div class="header-content">
          <div class="rating-icon">
            <i class="fas fa-star"></i>
          </div>
          <div class="header-text">
            <h4 class="modal-title">Détails de l'évaluation</h4>
            <p class="delivery-ref">#{{ratingData.deliveryId.slice(0, 8)}}</p>
          </div>
        </div>
        <button class="btn-close" (click)="close()">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <!-- Overall Rating -->
        <div class="overall-rating-section">
          <div class="overall-rating-display">
            <div class="rating-stars-large">
              <span *ngFor="let star of [1,2,3,4,5]" 
                    class="star-large"
                    [class.active]="star <= ratingData.overallRating">
                <i class="fas fa-star"></i>
              </span>
            </div>
            <div class="rating-score">
              <span class="score-value">{{ratingData.overallRating}}</span>
              <span class="score-max">/5</span>
            </div>
          </div>
          <div class="rating-meta">
            <div class="rating-type-badge" [ngClass]="'type-' + ratingData.ratingType">
              <i [class]="getRatingTypeIcon(ratingData.ratingType)"></i>
              {{getRatingTypeLabel(ratingData.ratingType)}}
            </div>
            <div class="rating-date">
              <i class="fas fa-calendar-alt"></i>
              {{formatDate(ratingData.ratedAt)}}
            </div>
          </div>
        </div>

        <!-- Delivery Info -->
        <div class="delivery-info-compact">
          <div class="info-item">
            <i class="fas fa-map-marker-alt"></i>
            <span>{{ratingData.deliveryAddress}}</span>
          </div>
        </div>

        <!-- Detailed Ratings Grid -->
        <div *ngIf="hasDetailedRatings()" class="detailed-ratings-grid">
          <h6 class="section-title">
            <i class="fas fa-chart-bar"></i>
            Évaluations détaillées
          </h6>
          
          <div class="ratings-grid">
            <div *ngIf="ratingData.punctualityRating" class="rating-item">
              <div class="rating-item-header">
                <i class="fas fa-clock"></i>
                <span>Ponctualité</span>
              </div>
              <div class="rating-item-stars">
                <span *ngFor="let star of [1,2,3,4,5]" 
                      class="mini-star"
                      [class.active]="star <= ratingData.punctualityRating">
                  <i class="fas fa-star"></i>
                </span>
                <span class="rating-number">{{ratingData.punctualityRating}}</span>
              </div>
            </div>

            <div *ngIf="ratingData.professionalismRating" class="rating-item">
              <div class="rating-item-header">
                <i class="fas fa-user-tie"></i>
                <span>Professionnalisme</span>
              </div>
              <div class="rating-item-stars">
                <span *ngFor="let star of [1,2,3,4,5]" 
                      class="mini-star"
                      [class.active]="star <= ratingData.professionalismRating">
                  <i class="fas fa-star"></i>
                </span>
                <span class="rating-number">{{ratingData.professionalismRating}}</span>
              </div>
            </div>

            <div *ngIf="ratingData.packageConditionRating" class="rating-item">
              <div class="rating-item-header">
                <i class="fas fa-box"></i>
                <span>État du colis</span>
              </div>
              <div class="rating-item-stars">
                <span *ngFor="let star of [1,2,3,4,5]" 
                      class="mini-star"
                      [class.active]="star <= ratingData.packageConditionRating">
                  <i class="fas fa-star"></i>
                </span>
                <span class="rating-number">{{ratingData.packageConditionRating}}</span>
              </div>
            </div>

            <div *ngIf="ratingData.communicationRating" class="rating-item">
              <div class="rating-item-header">
                <i class="fas fa-comments"></i>
                <span>Communication</span>
              </div>
              <div class="rating-item-stars">
                <span *ngFor="let star of [1,2,3,4,5]" 
                      class="mini-star"
                      [class.active]="star <= ratingData.communicationRating">
                  <i class="fas fa-star"></i>
                </span>
                <span class="rating-number">{{ratingData.communicationRating}}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Appreciated Categories -->
        <div *ngIf="ratingData.categories && ratingData.categories.length > 0" 
             class="categories-section">
          <h6 class="section-title">
            <i class="fas fa-thumbs-up"></i>
            Aspects appréciés
          </h6>
          <div class="categories-chips">
            <span *ngFor="let category of ratingData.categories" 
                  class="category-chip">
              <i [class]="getCategoryIcon(category)"></i>
              {{getCategoryLabel(category)}}
            </span>
          </div>
        </div>

        <!-- Comment -->
        <div *ngIf="ratingData.comment" class="comment-section">
          <h6 class="section-title">
            <i class="fas fa-comment-alt"></i>
            Commentaire
          </h6>
          <div class="comment-bubble">
            <div class="comment-text">
              <i class="fas fa-quote-left quote-icon"></i>
              <p>{{ratingData.comment}}</p>
            </div>
          </div>
        </div>

        <!-- Recommendation -->
        <div *ngIf="ratingData.wouldRecommend !== null && ratingData.wouldRecommend !== undefined" 
             class="recommendation-section">
          <div class="recommendation-display" 
               [class.positive]="ratingData.wouldRecommend" 
               [class.negative]="!ratingData.wouldRecommend">
            <div class="recommendation-icon">
              <i class="fas" 
                 [class.fa-heart]="ratingData.wouldRecommend"
                 [class.fa-heart-broken]="!ratingData.wouldRecommend"></i>
            </div>
            <div class="recommendation-text">
              <span *ngIf="ratingData.wouldRecommend">Recommande ExpedNow</span>
              <span *ngIf="!ratingData.wouldRecommend">Ne recommande pas ExpedNow</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="close()">
          <i class="fas fa-check"></i>
          Fermer
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./rating-details-modal.component.css']
})
export class RatingDetailsModalComponent implements OnInit {
  ratingData: DetailedRatingResponse;

  constructor(
    private dialogRef: MatDialogRef<RatingDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { ratingData: DetailedRatingResponse }
  ) {
    this.ratingData = data.ratingData;
  }

  ngOnInit(): void {
    console.log('Rating details loaded:', this.ratingData);
  }

  close(): void {
    this.dialogRef.close();
  }

  getRatingTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'overall': 'Service Global',
      'delivery_person': 'Livreur',
      'service': 'Qualité du Service'
    };
    return labels[type] || type;
  }

  getRatingTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'overall': 'fas fa-star',
      'delivery_person': 'fas fa-user',
      'service': 'fas fa-truck'
    };
    return icons[type] || 'fas fa-star';
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

  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'punctuality': 'fas fa-clock',
      'professionalism': 'fas fa-user-tie',
      'package_condition': 'fas fa-box',
      'communication': 'fas fa-comments'
    };
    return icons[category] || 'fas fa-check';
  }

  hasDetailedRatings(): boolean {
    return !!(
      this.ratingData.punctualityRating ||
      this.ratingData.professionalismRating ||
      this.ratingData.packageConditionRating ||
      this.ratingData.communicationRating
    );
  }

  formatDate(dateString: string): string {
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      return 'Date invalide';
    }
  }
}