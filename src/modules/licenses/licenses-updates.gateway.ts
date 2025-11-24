import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { License } from '../../entities/license.entity';

@Injectable()
export class LicensesUpdatesGateway {
  private licenseUpdates$ = new Subject<License>();

  emitLicenseUpdate(license: License): void {
    this.licenseUpdates$.next(license);
  }

  getLicenseUpdates(): Observable<MessageEvent> {
    return this.licenseUpdates$.pipe(
      map(
        (license) =>
          ({
            data: license,
            type: 'license-updated',
          }) as unknown as MessageEvent,
      ),
    );
  }
}
