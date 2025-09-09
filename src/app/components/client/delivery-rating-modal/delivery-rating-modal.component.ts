// delivery-rating-modal.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { DeliveryService, DetailedRatingRequest, DeliveryRequest } from '../../../services/delivery-service.service';
import { ToastService } from '../../../services/toast.service';

interface RatingCategory {
  id: string;
  label: string;
  icon: string;
}

interface RatingType {
  key: 'overall' | 'delivery_person' | 'service';
  label: string;
  icon: string;
}

@Component({
  selector: 'app-delivery-rating-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatCheckboxModule,
    MatSelectModule
],
  template: `
    <div class="rating-modal">
      <div class="modal-header">
        <h2><i class="fas fa-star"></i> Évaluer votre livraison</h2>
        <button class="btn-close" (click)="close()" type="button">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="modal-body">
        <!-- Informations de la livraison -->
        <div class="delivery-info">
          <div class="delivery-summary">
            <h4>Livraison #{{delivery.id.slice(0, 8)}}</h4>
            <p><i class="fas fa-map-marker-alt"></i> {{delivery.deliveryAddress}}</p>
            <p><i class="fas fa-calendar"></i> {{formatDate(delivery.completedAt)}}</p>
            <p><i class="fas fa-user"></i> Livreur: {{getDeliveryPersonName()}}</p>
          </div>
        </div>

        <!-- Type d'évaluation -->
        <div class="rating-type-section">
          <label class="section-label">Type d'évaluation</label>
          <div class="rating-type-buttons">
            <button 
              *ngFor="let type of ratingTypes" 
              class="rating-type-btn"
              [class.active]="ratingData.ratingType === type.key"
              (click)="setRatingType(type.key)">
              <i [class]="type.icon"></i>
              {{type.label}}
            </button>
          </div>
        </div>

        <!-- Évaluation principale -->
        <div class="main-rating-section">
          <label class="section-label">Note globale *</label>
          <div class="star-rating">
            <span *ngFor="let star of [1,2,3,4,5]" 
                  class="star"
                  [class.active]="star <= (hoverRating || ratingData.rating)"
                  (click)="setRating(star)"
                  (mouseenter)="hoverRating = star"
                  (mouseleave)="hoverRating = 0">
              <i class="fas fa-star"></i>
            </span>
          </div>
          <p class="rating-description">{{getRatingDescription(ratingData.rating)}}</p>
        </div>

        <!-- Évaluations par catégorie -->
        <div class="category-ratings" *ngIf="ratingData.rating > 0">
          <label class="section-label">Aspects particulièrement appréciés</label>
          <div class="categories-grid">
            <label *ngFor="let category of ratingCategories" class="category-item">
         <input type="checkbox" 
       [ngModel]="ratingData.categories.includes(category.id)"
       (ngModelChange)="toggleCategory(category.id)">
              <div class="category-content">
                <i [class]="category.icon"></i>
                <span>{{category.label}}</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Évaluations détaillées par aspect -->
        <div class="detailed-ratings" *ngIf="ratingData.rating >= 4">
          <label class="section-label">Évaluations détaillées (optionnel)</label>
          
          <div class="detailed-rating-item">
            <label>Ponctualité</label>
            <div class="mini-star-rating">
              <span *ngFor="let star of [1,2,3,4,5]" 
                    class="mini-star"
                    [class.active]="star <= (ratingData.punctualityRating || 0)"
                    (click)="setPunctualityRating(star)">
                <i class="fas fa-star"></i>
              </span>
            </div>
          </div>

          <div class="detailed-rating-item">
            <label>Professionnalisme</label>
            <div class="mini-star-rating">
              <span *ngFor="let star of [1,2,3,4,5]" 
                    class="mini-star"
                    [class.active]="star <= (ratingData.professionalismRating || 0)"
                    (click)="setProfessionalismRating(star)">
                <i class="fas fa-star"></i>
              </span>
            </div>
          </div>

          <div class="detailed-rating-item">
            <label>État du colis</label>
            <div class="mini-star-rating">
              <span *ngFor="let star of [1,2,3,4,5]" 
                    class="mini-star"
                    [class.active]="star <= (ratingData.packageConditionRating || 0)"
                    (click)="setPackageConditionRating(star)">
                <i class="fas fa-star"></i>
              </span>
            </div>
          </div>

          <div class="detailed-rating-item">
            <label>Communication</label>
            <div class="mini-star-rating">
              <span *ngFor="let star of [1,2,3,4,5]" 
                    class="mini-star"
                    [class.active]="star <= (ratingData.communicationRating || 0)"
                    (click)="setCommunicationRating(star)">
                <i class="fas fa-star"></i>
              </span>
            </div>
          </div>
        </div>

        <!-- Commentaires rapides -->
        <div class="quick-comments" *ngIf="ratingData.rating > 0">
          <label class="section-label">Commentaires rapides</label>
          <div class="quick-comments-grid">
            <button *ngFor="let comment of quickComments" 
                    class="quick-comment-btn"
                    type="button"
                    (click)="addQuickComment(comment)">
              {{comment}}
            </button>
          </div>
        </div>

        <!-- Commentaire détaillé -->
        <div class="comment-section" *ngIf="ratingData.rating > 0">
          <label class="section-label" for="comment">Commentaire détaillé</label>
          <textarea 
            id="comment"
            [(ngModel)]="ratingData.comment"
            placeholder="Partagez votre expérience pour nous aider à améliorer notre service..."
            class="comment-textarea"
            maxlength="500"
            rows="4">
          </textarea>
          <small class="char-count">{{getCommentLength()}}/500 caractères</small>
        </div>

        <!-- Recommandation -->
        <div class="recommendation-section" *ngIf="ratingData.rating >= 4">
          <label class="checkbox-label">
            <input type="checkbox" [(ngModel)]="ratingData.wouldRecommend">
            <span class="checkmark"></span>
            Je recommanderais ExpedNow à mes amis
          </label>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" (click)="close()" type="button">
          Annuler
        </button>
        <button class="btn btn-primary" 
                (click)="submitRating()" 
                [disabled]="!ratingData.rating || isSubmitting"
                type="button">
          <i *ngIf="isSubmitting" class="fas fa-spinner fa-spin"></i>
          <i *ngIf="!isSubmitting" class="fas fa-star"></i>
          {{isSubmitting ? 'Envoi...' : 'Soumettre l\'évaluation'}}
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./delivery-rating-modal.component.css']
})
export class DeliveryRatingModalComponent implements OnInit {
  delivery: DeliveryRequest;
  ratingData: DetailedRatingRequest;
  hoverRating = 0;
  isSubmitting = false;

  ratingTypes: RatingType[] = [
    { key: 'overall', label: 'Service Global', icon: 'fas fa-star' },
    { key: 'delivery_person', label: 'Livreur', icon: 'fas fa-user' },
    { key: 'service', label: 'Qualité Service', icon: 'fas fa-truck' }
  ];

  ratingCategories: RatingCategory[] = [
    { id: 'punctuality', label: 'Ponctualité', icon: 'fas fa-clock' },
    { id: 'professionalism', label: 'Professionnalisme', icon: 'fas fa-user-tie' },
    { id: 'package_condition', label: 'État du Colis', icon: 'fas fa-box' },
    { id: 'communication', label: 'Communication', icon: 'fas fa-comments' }
  ];

  quickComments: string[] = [
    'Service excellent !',
    'Livraison rapide et soignée',
    'Livreur très professionnel',
    'Colis en parfait état',
    'Communication claire',
    'Ponctuel et efficace'
  ];

  constructor(
    private dialogRef: MatDialogRef<DeliveryRatingModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { delivery: DeliveryRequest },
    private deliveryService: DeliveryService,
    private toastService: ToastService
  ) {
    this.delivery = data.delivery;
    
    // Initialize rating data with proper types
    this.ratingData = {
      rating: 0,
      comment: '',
      categories: [],
      ratingType: 'overall',
      wouldRecommend: false,
      improvements: []
    };
  }

  ngOnInit(): void {
    // Pre-fill data if delivery has basic rating
    if (this.delivery.rating) {
      this.ratingData.rating = this.delivery.rating;
    }
  }

  // Add this method to format dates manually
  formatDate(dateString?: string): string {
    if (!dateString) return 'Date non disponible';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Date invalide';
    }
  }

  getRatingDescription(rating: number): string {
    const descriptions: { [key: number]: string } = {
      0: 'Cliquez sur une étoile pour noter',
      1: 'Très insatisfait',
      2: 'Insatisfait', 
      3: 'Correct',
      4: 'Satisfait',
      5: 'Très satisfait'
    };
    return descriptions[rating] || '';
  }

  getDeliveryPersonName(): string {
    // This would come from the delivery person data
    return 'Nom du livreur'; // Placeholder
  }

  getCommentLength(): number {
    return this.ratingData.comment?.length || 0;
  }

  setRatingType(type: 'overall' | 'delivery_person' | 'service'): void {
    this.ratingData.ratingType = type;
  }

  setRating(rating: number): void {
    this.ratingData.rating = rating;
  }

  setPunctualityRating(rating: number): void {
    this.ratingData.punctualityRating = rating;
  }

  setProfessionalismRating(rating: number): void {
    this.ratingData.professionalismRating = rating;
  }

  setPackageConditionRating(rating: number): void {
    this.ratingData.packageConditionRating = rating;
  }

  setCommunicationRating(rating: number): void {
    this.ratingData.communicationRating = rating;
  }

  toggleCategory(categoryId: string): void {
    const index = this.ratingData.categories.indexOf(categoryId);
    if (index > -1) {
      this.ratingData.categories.splice(index, 1);
    } else {
      this.ratingData.categories.push(categoryId);
    }
  }

  addQuickComment(comment: string): void {
    if (this.ratingData.comment) {
      this.ratingData.comment += ' ' + comment;
    } else {
      this.ratingData.comment = comment;
    }
  }

  submitRating(): void {
    if (!this.ratingData.rating) {
      this.toastService.showError('Veuillez sélectionner une note');
      return;
    }

    this.isSubmitting = true;

    this.deliveryService.submitDetailedRating(this.delivery.id, this.ratingData)
      .subscribe({
        next: (response: any) => {
          this.toastService.showSuccess('Évaluation soumise avec succès !');
          this.dialogRef.close({ success: true, rating: response.rating });
        },
        error: (error: any) => {
          this.toastService.showError(error.message || 'Erreur lors de la soumission');
          this.isSubmitting = false;
        }
      });
  }

  close(): void {
    this.dialogRef.close();
  }
}