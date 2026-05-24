import { provideRouter } from '@angular/router';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';

jest.mock('../../app.routes', () => ({
  routes: [
    { path: 'mock-1', data: { title: 'Mock Route 1', icon: 'bi-1' } },
    { path: 'mock-2', data: { title: 'Mock Route 2', icon: 'bi-2' } },
    { path: 'hidden' }, // Route ohne data-Objekt
    { path: '', redirectTo: 'mock-1', pathMatch: 'full' } // Weiterleitung
  ]
}));

import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let spectator: Spectator<SidebarComponent>;

  const createComponent = createComponentFactory({
    component: SidebarComponent,
    providers: [
      // Stellt die Router-Abhängigkeiten für RouterLink und RouterLinkActive bereit
      provideRouter([])
    ]
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should create the component', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('should correctly map menu items from app.routes.ts', () => {
    const items = spectator.component.menuItems;

    // Wir erwarten 2 Routen, da die gemockten Weiterleitungen/versteckten Routen ohne title-Data gefiltert werden sollten
    expect(items.length).toBe(2);

    expect(items[0]).toEqual({ path: '/mock-1', title: 'Mock Route 1', icon: 'bi-1' });
    expect(items[1]).toEqual({ path: '/mock-2', title: 'Mock Route 2', icon: 'bi-2' });
  });

  it('should render a navigation link for each menu item', () => {
    const navLinks = spectator.queryAll('.nav-link');

    expect(navLinks.length).toBe(2);
    expect(navLinks[0].textContent?.trim()).toContain('Mock Route 1');
    expect(navLinks[1].textContent?.trim()).toContain('Mock Route 2');
  });
});