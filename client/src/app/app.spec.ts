import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { App } from './app';
import { AppModule } from './app-module';

const SESSION_USER = { id: '1', name: 'Ana', email: 'ana@example.com' };

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(App);
    httpMock.expectOne('/api/auth/me').flush(SESSION_USER);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    httpMock.verify();
  });

  it('should render the health status from the API', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('/api/auth/me').flush(SESSION_USER);
    httpMock.expectOne('/api/health').flush({ status: 'ok' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('p')?.textContent).toContain('ok');
    httpMock.verify();
  });
});
