import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, Subject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import * as L from 'leaflet';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';

export interface PlaceResult {
  address: string;
  latitude: number;
  longitude: number;
}

@Injectable({ providedIn: 'root' })
export class MapService {
  private map!: L.Map;
  private marker!: L.Marker;
  private selectedAddressSource = new Subject<PlaceResult>();
  private activeType: 'pickup' | 'delivery' | null = null;
  private searchProvider: any = new OpenStreetMapProvider();


  selectedAddress$ = this.selectedAddressSource.asObservable();

  constructor(private http: HttpClient) {}

  initializeMap(container: HTMLElement, coords?: L.LatLngExpression): void {
    const defaultCoords: L.LatLngExpression = [36.8065, 10.1815];
    this.map = L.map(container).setView(coords || defaultCoords, 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.initializeMarker(coords || defaultCoords);
    this.addSearchControl();
    this.setupMapEvents();
  }

  private initializeMarker(coords: L.LatLngExpression): void {
    this.marker = L.marker(coords, { 
      draggable: true,
      icon: L.icon({
        iconUrl: 'assets/marker-icon.png',
        shadowUrl: 'assets/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
      })
    }).addTo(this.map);
  }

  private addSearchControl(): void {
    const searchControl = new (GeoSearchControl as any)({
      provider: this.searchProvider,
      style: 'bar',
      showMarker: false,
      autoClose: true
    });
    
    this.map.addControl(searchControl);
  }

  private setupMapEvents(): void {
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.updatePosition(e.latlng);
    });

    this.marker.on('dragend', (e: L.DragEndEvent) => {
      this.updatePosition(e.target.getLatLng());
    });
  }

  setupMapInteraction(type: 'pickup' | 'delivery'): void {
    this.activeType = type;
  }

  private async updatePosition(latlng: L.LatLng): Promise<void> {
    this.marker.setLatLng(latlng);
    this.map.setView(latlng);
    
    try {
      // Use toPromise() with error handling
      const address = await this.reverseGeocode(latlng.lat, latlng.lng).toPromise();
      this.selectedAddressSource.next({
        address: address || 'Address unknown', // Handle potential undefined
        latitude: latlng.lat,
        longitude: latlng.lng
      });
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  }
  
  reverseGeocode(lat: number, lon: number): Observable<string> {
    return this.http.get<any>(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    ).pipe(
      map(response => response.display_name || 'Address unknown'), // Ensure we always return a string
      catchError(() => of('Address unknown'))
    );
  }

  searchAddress(query: string): Observable<PlaceResult[]> {
    return this.http.get<any[]>(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
    ).pipe(
      map(results => results.map(result => ({
        address: result.display_name,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon)
      }))),
      catchError(() => of([]))
    );
  }

  calculateDistance(origin: [number, number], destination: [number, number]): number {
    const [lat1, lon1] = origin;
    const [lat2, lon2] = destination;
    
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  cleanupMap(): void {
    if (this.map) {
      this.map.remove();
    }
  }
}