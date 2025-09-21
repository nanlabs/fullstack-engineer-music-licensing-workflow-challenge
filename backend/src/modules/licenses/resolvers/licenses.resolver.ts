import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UpdateLicenseStatusInput } from '../dto/update-license-status.input';
import { LicenseStatus } from '../entities/license-status.entity';
import { LicensesService } from '../services/licenses.service';

@Resolver(() => LicenseStatus)
export class LicensesResolver {
  constructor(private readonly licensesService: LicensesService) {}

  @Query(() => [LicenseStatus], { name: 'licenseHistory' })
  async getLicenseHistory(
    @Args('songId', { type: () => ID }) songId: number,
  ): Promise<LicenseStatus[]> {
    return await this.licensesService.getLicenseHistory(songId);
  }

  @Query(() => LicenseStatus, { name: 'currentLicenseStatus', nullable: true })
  async getCurrentLicenseStatus(
    @Args('songId', { type: () => ID }) songId: number,
  ): Promise<LicenseStatus | null> {
    return await this.licensesService.getCurrentLicenseStatus(songId);
  }

  @Query(() => String, { name: 'licenseStatistics' })
  async getStatistics(): Promise<any> {
    return await this.licensesService.getStatusStatistics();
  }

  @Mutation(() => LicenseStatus)
  async updateSongLicenseStatus(
    @Args('songId', { type: () => ID }) songId: number,
    @Args('updateLicenseStatusInput') updateLicenseStatusInput: UpdateLicenseStatusInput,
  ): Promise<LicenseStatus> {
    return await this.licensesService.updateSongLicenseStatus(songId, updateLicenseStatusInput);
  }

  @Mutation(() => LicenseStatus)
  async updateSongLicenseStatusByTrack(
    @Args('trackId', { type: () => ID }) trackId: number,
    @Args('updateLicenseStatusInput') updateLicenseStatusInput: UpdateLicenseStatusInput,
  ): Promise<LicenseStatus> {
    return await this.licensesService.updateSongLicenseStatusByTrack(
      trackId,
      updateLicenseStatusInput,
    );
  }
}
