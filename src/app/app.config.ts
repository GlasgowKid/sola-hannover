import { APP_BASE_HREF } from '@angular/common';
import { ApplicationConfig, importProvidersFrom, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ModalModule } from 'ngx-bootstrap/modal';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    importProvidersFrom(ModalModule.forRoot()),
    { provide: LOCALE_ID, useValue: 'de-DE' },
    { provide: APP_BASE_HREF, useValue: environment.extensionKey ? `/ccm/${environment.extensionKey}/` : '/' }
  ]
};
