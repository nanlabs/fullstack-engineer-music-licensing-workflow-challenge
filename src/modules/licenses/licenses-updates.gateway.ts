import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { License } from '../../entities/license.entity';

@Injectable()
export class LicensesUpdatesGateway {
  private licenseUpdates$ = new Subject<License>();

  /**
   * Emitir actualización de licencia a todos los clientes conectados
   */
  emitLicenseUpdate(license: License): void {
    this.licenseUpdates$.next(license);
  }

  /**
   * Stream de actualizaciones para SSE
   * Cada cliente que se conecte recibirá todas las actualizaciones futuras
   */
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
