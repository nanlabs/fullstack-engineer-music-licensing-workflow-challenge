import { Transactional } from 'typeorm-transactional'
import { Injectable, Inject } from '@nestjs/common'
import { Subject } from 'rxjs/internal/Subject'
import { Observable, map } from 'rxjs'

import { APPLICATION_ERRORS } from '@/src/app/common/response-normalizer/errors'
import { throwError } from '@/src/shared/utils/throw-error'
import { LicenseStatus } from '@/src/app/database/types'

import { LicenseHistoryRepository } from '../../license-history/domain/license-history.repository.interface'
import { LicensesRepository } from '../domain/licenses.repository.interface'
import { LicenseStatusEvent } from '../domain/licenses.types'
import { Licenses } from '../domain/licenses.entity'

@Injectable()
export class LicensesService {
  private licenseStatusChanges$ = new Subject<LicenseStatusEvent>()

  constructor(
    @Inject(LicensesRepository)
    private readonly licensesRepository: LicensesRepository,
    @Inject(LicenseHistoryRepository)
    private readonly licenseHistoryRepository: LicenseHistoryRepository,
  ) {}

  @Transactional()
  async update(input: {
    id: number
    status: LicenseStatus
  }): Promise<Licenses> {
    const license = await this.licensesRepository.findOneByIdOrFail(input.id)

    if (!this.canTransition(license.status, input.status)) {
      throwError(APPLICATION_ERRORS.LICENSES.INVALID_TRANSITION, {
        overrideMessage: `Cannot change license from ${license.status} to ${input.status}`,
      })
    }

    await this.licensesRepository.update(input)

    await this.licenseHistoryRepository.create({
      licenseId: input.id,
      oldStatus: license.status,
      newStatus: input.status,
    })

    const updatedLicense = await this.licensesRepository.findOneByIdOrFail(
      input.id,
    )

    this.licenseStatusChanges$.next({
      licenseId: updatedLicense.id,
      newStatus: updatedLicense.status,
      updatedAt: updatedLicense.updatedAt,
    })

    return updatedLicense
  }

  licenseStatusStream(): Observable<{ data: LicenseStatusEvent }> {
    return this.licenseStatusChanges$
      .asObservable()
      .pipe(map(event => ({ data: event })))
  }

  private licenseStateTransitions: Record<LicenseStatus, LicenseStatus[]> = {
    [LicenseStatus.PENDING]: [LicenseStatus.NEGOCIATING],
    [LicenseStatus.APPROVED]: [LicenseStatus.EXPIRED],
    [LicenseStatus.REJECTED]: [],
    [LicenseStatus.EXPIRED]: [],
    [LicenseStatus.NEGOCIATING]: [
      LicenseStatus.APPROVED,
      LicenseStatus.REJECTED,
    ],
  }

  private canTransition(current: LicenseStatus, next: LicenseStatus): boolean {
    return this.licenseStateTransitions[current].includes(next)
  }
}
