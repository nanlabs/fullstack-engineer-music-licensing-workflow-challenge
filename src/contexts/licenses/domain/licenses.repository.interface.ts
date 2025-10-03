import { Licenses } from './licenses.entity'

export abstract class LicensesRepository {
  abstract create(
    license: Pick<Licenses, 'trackId' | 'rightsHolder' | 'status' | 'notes'>,
  ): Promise<Licenses>
  abstract update(license: Pick<Licenses, 'status' | 'id'>): Promise<boolean>
  abstract findOneByIdOrFail(id: number): Promise<Licenses>
}
