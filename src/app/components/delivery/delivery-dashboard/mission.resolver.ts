import { Injectable } from "@angular/core";
import { Mission } from "../../../models/mission.model";
import { ActivatedRouteSnapshot, Resolve } from "@angular/router";
import { MissionService } from "../../../services/mission-service.service";
import { Observable } from "rxjs";

@Injectable({ providedIn: 'root' })
export class MissionResolver implements Resolve<Mission> {
  constructor(private missionService: MissionService) {}

  resolve(route: ActivatedRouteSnapshot): Observable<Mission> {
    return this.missionService.getMissionDetails(route.paramMap.get('id')!);
  }
}