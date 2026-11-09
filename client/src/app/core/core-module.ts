import { APP_INITIALIZER, NgModule, Optional, SkipSelf } from '@angular/core';
import { AuthService } from './auth.service';

export function restoreSessionFactory(auth: AuthService): () => Promise<void> {
  return () => auth.restoreSession();
}

@NgModule({
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: restoreSessionFactory,
      deps: [AuthService],
      multi: true,
    },
  ],
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parent: CoreModule | null) {
    if (parent) {
      throw new Error('CoreModule solo puede importarse en AppModule.');
    }
  }
}
