import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/common/helpers/app-setup.helper';

let app: INestApplication | null = null;
let appPromise: Promise<INestApplication> | null = null;

export async function getApp(): Promise<INestApplication> {
  if (app) {
    return app;
  }

  if (appPromise) {
    return appPromise;
  }

  appPromise = (async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const appInstance = moduleFixture.createNestApplication();
    setupApp(appInstance);
    await appInstance.init();
    app = appInstance;
    return appInstance;
  })();

  return appPromise;
}

export async function closeApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
    appPromise = null;
  }
}
