import { TypeOrmModuleOptions, TypeOrmModule } from '@nestjs/typeorm'
import { addTransactionalDataSource } from 'typeorm-transactional'
import { DataSourceOptions, DataSource } from 'typeorm'
import { Module } from '@nestjs/common'

import { EnvironmentConfigService } from '../common/environment-config/environment-config.service'
import { EnvironmentConfigModule } from '../common/environment-config/environment-config.module'
import { getEntities } from '../setup/get-entities'

export async function dataSourceFactory(
  options?: DataSourceOptions,
): Promise<DataSource> {
  if (!options) {
    throw new Error('Invalid options passed')
  }
  const dataSource = new DataSource(options)

  return addTransactionalDataSource(dataSource)
}

export const getTypeOrmModuleOptions = (
  config: EnvironmentConfigService,
): TypeOrmModuleOptions => {
  return {
    type: 'postgres',
    host: config.getDatabaseHost(),
    port: config.getDatabasePort(),
    username: config.getDatabaseUser(),
    password: config.getDatabasePassword(),
    database: config.getDatabaseName(),
    synchronize: config.getDatabaseSync(),
    entities: getEntities(),
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [EnvironmentConfigModule],
      inject: [EnvironmentConfigService],
      useFactory: getTypeOrmModuleOptions,
      dataSourceFactory,
    }),
  ],
})
export class TypeOrmConfigModule {}
