import {
  NgModule,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { CoreModule } from './core/core-module';
import { authInterceptor } from './core/auth.interceptor';

registerLocaleData(localeEs);

@NgModule({
  declarations: [App],
  imports: [BrowserModule, AppRoutingModule, CoreModule],
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'es-ES' },
  ],
  bootstrap: [App],
})
export class AppModule {}
