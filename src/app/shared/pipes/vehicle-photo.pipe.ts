import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../../environments/environment';

@Pipe({
  name: 'vehiclePhoto'
})
export class VehiclePhotoPipe implements PipeTransform {
  transform(photoPath: string | undefined): string {
    if (!photoPath) return '/assets/images/no-vehicle-photo.png';
    if (photoPath.startsWith('http')) return photoPath;
    return `${environment.apiUrl.replace('/api','')}/uploads/vehicle-photos/${photoPath}`;
}
}