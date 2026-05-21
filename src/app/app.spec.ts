import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { App } from './app';
import { provideRouter } from '@angular/router';

describe('App', () => {
  let spectator: Spectator<App>;
  
  const createComponent = createComponentFactory({
    component: App,
    providers: [provideRouter([])]
  });

  beforeEach(async () => {
    spectator = createComponent();
  });

  it('should create the app', () => {
    expect(spectator.component).toBeTruthy();
  });
});
