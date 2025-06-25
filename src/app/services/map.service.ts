import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import 'leaflet-routing-machine';
import { icon, Marker } from 'leaflet';

// Fix for default marker icons
const defaultIcon = icon({
  iconRetinaUrl: 'assets/marker-icon-2x.png',
  iconUrl: 'assets/marker-icon.png',
  shadowUrl: 'assets/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

Marker.prototype.options.icon = defaultIcon;

interface MapMarkerOptions {
  position: L.LatLngExpression;
  title?: string;
  icon?: L.Icon | L.DivIcon;
  animation?: boolean;
}

interface MapInitOptions {
  center: L.LatLngExpression;
  zoom: number;
  mapType?: 'roadmap' | 'satellite';
}

interface RouteResult {
  distance: string;
  duration: string;
  waypoints?: L.LatLng[];
}

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private map: L.Map | null = null;
  private routingControl: L.Routing.Control | null = null;
  private markers: L.Marker[] = [];
  private isReady = true; // Leaflet doesn't need async loading

  constructor() {}

  initMap(mapElement: HTMLElement, options: MapInitOptions): Promise<void> {
    return new Promise((resolve) => {
      if (!mapElement) {
        throw new Error('Map element not found');
      }

      // Create map
      this.map = L.map(mapElement, {
        center: options.center,
        zoom: options.zoom,
        zoomControl: false // We'll add it manually for better positioning
      });

      // Add zoom control with better position
      L.control.zoom({
        position: 'topright'
      }).addTo(this.map);

      // Add tile layer
      this.setMapType(options.mapType || 'roadmap');

      // Add scale control
      L.control.scale({ position: 'bottomleft' }).addTo(this.map);

      // Resolve when map is ready
      this.map.whenReady(() => {
        resolve();
      });
    });
  }

// Add these modifications to your MapService

async showRoute(start: L.LatLngExpression, end: L.LatLngExpression): Promise<RouteResult | null> {
  if (!this.map) {
    throw new Error('Map not initialized');
  }

  // Clear existing route if any
  if (this.routingControl) {
    this.map.removeControl(this.routingControl);
    this.routingControl = null;
  }

  // Add custom markers first
  await this.addCustomMarkers(start, end);

  return new Promise((resolve) => {
    try {
      this.routingControl = L.Routing.control({
        waypoints: [
          L.latLng(start),
          L.latLng(end)
        ],
        routeWhileDragging: false,
        showAlternatives: false,
        addWaypoints: false,
        fitSelectedRoutes: true,
        // HIDE THE DEFAULT INSTRUCTION PANEL
        createMarker: function() { return null; }, // Don't create default markers
        lineOptions: {
          styles: [{ color: '#4285F4', opacity: 0.8, weight: 4 }],
          extendToWaypoints: true,
          missingRouteTolerance: 0
        },
        // Hide the routing instructions panel
        show: false,
        collapsible: false
      } as any).addTo(this.map!);

      // Hide the routing control container after it's added
      setTimeout(() => {
        const routingContainer = document.querySelector('.leaflet-routing-container');
        if (routingContainer) {
          (routingContainer as HTMLElement).style.display = 'none';
        }
      }, 100);

      this.routingControl.on('routesfound', (e) => {
        const routes = e.routes;
        if (routes && routes.length > 0) {
          const route = routes[0];
          resolve({
            distance: `${Math.round(route.summary.totalDistance / 1000)} km`,
            duration: `${Math.round(route.summary.totalTime / 60)} min`,
            waypoints: route.coordinates
          });
        } else {
          this.fitBounds([start, end]);
          resolve(null);
        }
      });

      this.routingControl.on('routingerror', () => {
        this.fitBounds([start, end]);
        resolve(null);
      });
    } catch (error) {
      console.error('Error showing route:', error);
      this.fitBounds([start, end]);
      resolve(null);
    }
  });
}

  private async addCustomMarkers(
    pickup: L.LatLngExpression,
    delivery: L.LatLngExpression
  ): Promise<void> {
    this.clearMarkers();
    
    // Create custom icons
    const pickupIcon = L.icon({
      iconUrl: 'assets/map-marker-pickup.jpeg',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    const deliveryIcon = L.icon({
      iconUrl: 'assets/map-marker-delivery.jpeg',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    // Pickup marker
    const pickupMarker = L.marker(pickup, {
      icon: pickupIcon,
      title: 'Pickup Location'
    }).addTo(this.map!);

    pickupMarker.bindPopup('<div style="font-weight: bold; color: #4CAF50;">📍 Pickup Location</div>');
    this.markers.push(pickupMarker);

    // Delivery marker
    const deliveryMarker = L.marker(delivery, {
      icon: deliveryIcon,
      title: 'Delivery Location'
    }).addTo(this.map!);

    deliveryMarker.bindPopup('<div style="font-weight: bold; color: #F44336;">📍 Delivery Location</div>');
    this.markers.push(deliveryMarker);
  }

  async addMarker(options: {
    position: L.LatLngExpression;
    title: string;
    label: string;
    color: string;
    address?: string;
  }): Promise<void> {
    if (!this.map) return;

    // Create custom icon with circle and label
    const markerIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          background-color: ${options.color};
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
        ">
          ${options.label}
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10]
    });

    const marker = L.marker(options.position, {
      icon: markerIcon,
      title: options.title
    }).addTo(this.map);

    if (options.address) {
      marker.bindPopup(`
        <div style="font-weight: bold; color: ${options.color}">
          ${options.title}
        </div>
        <div style="margin-top: 5px">${options.address}</div>
      `);
    }

    this.markers.push(marker);
  }

  async setMapType(mapType: 'roadmap' | 'satellite'): Promise<void> {
    if (!this.map) return;
    
    // Remove existing tile layers
    this.map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        this.map!.removeLayer(layer);
      }
    });

    // Add new tile layer based on map type
    if (mapType === 'satellite') {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19
      }).addTo(this.map);
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(this.map);
    }
  }

  async centerMap(pickup: L.LatLngExpression, delivery: L.LatLngExpression): Promise<void> {
    if (!this.map) return;
    
    const bounds = L.latLngBounds([pickup, delivery]);
    this.map.fitBounds(bounds, { padding: [50, 50] });
  }

  async fitBounds(locations: L.LatLngExpression[]): Promise<void> {
    if (!this.map || !locations.length) return;
    
    const bounds = L.latLngBounds(locations);
    this.map.fitBounds(bounds);
  }

  async captureMapImage(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.map) {
        resolve('');
        return;
      }

      // Create a temporary canvas
      const mapDiv = this.map.getContainer();
      const canvas = document.createElement('canvas');
      canvas.width = mapDiv.offsetWidth;
      canvas.height = mapDiv.offsetHeight;
      const context = canvas.getContext('2d');

      if (!context) {
        resolve('');
        return;
      }

      // Use html2canvas or similar library for better results
      // This is a simplified version that may not work perfectly
      const mapImg = new Image();
      mapImg.onload = () => {
        context.drawImage(mapImg, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      
      // This is a fallback - consider using a proper library
      mapImg.src = 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
          <rect width="100%" height="100%" fill="#f0f0f0"/>
          <text x="50%" y="50%" text-anchor="middle" fill="#666">Map screenshot</text>
        </svg>
      `);
    });
  }

  private clearMarkers(): void {
    this.markers.forEach(marker => {
      if (this.map) {
        this.map.removeLayer(marker);
      }
    });
    this.markers = [];
  }

  destroy(): void {
    this.clearMarkers();
    
    if (this.routingControl && this.map) {
      this.map.removeControl(this.routingControl);
      this.routingControl = null;
    }
    
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}