import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  BACKEND_PORT: number;
  BACKEND_PORT2: number;
  API_VERSION: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  PGADMIN_EMAIL: string;
  PGADMIN_PASSWORD: string;
  PGADMIN_PORT: number;
  REDIS_HOST: string;
  REDIS_PORT: number;
}

const envsSchema = joi
  .object({
    BACKEND_PORT: joi.number().default(3000),
    BACKEND_PORT2: joi.number().default(3001),
    API_VERSION: joi.string().required(),
    DB_HOST: joi.string().required(),
    DB_PORT: joi.number().required(),
    DB_USER: joi.string().required(),
    DB_PASSWORD: joi.string().required(),
    DB_NAME: joi.string().required(),
    PGADMIN_EMAIL: joi.string().required(),
    PGADMIN_PASSWORD: joi.string().required(),
    PGADMIN_PORT: joi.number().required(),
    REDIS_HOST: joi.string().required(),
    REDIS_PORT: joi.number().required(),
  })
  .unknown(true);

const { error, value } = envsSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value;

export const envs = {
  backendPort: envVars.BACKEND_PORT,
  backendPort2: envVars.BACKEND_PORT2,
  apiVersion: envVars.API_VERSION,
  dbHost: envVars.DB_HOST,
  dbPort: envVars.DB_PORT,
  dbUser: envVars.DB_USER,
  dbPassword: envVars.DB_PASSWORD,
  dbName: envVars.DB_NAME,
  pgadminEmail: envVars.PGADMIN_EMAIL,
  pgadminPassword: envVars.PGADMIN_PASSWORD,
  pgadminPort: envVars.PGADMIN_PORT,
  redisHost: envVars.REDIS_HOST,
  redisPort: envVars.REDIS_PORT,
};
