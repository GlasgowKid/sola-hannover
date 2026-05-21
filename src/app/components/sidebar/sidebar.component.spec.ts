import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { provideRouter } from '@angular/router';
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
    
    // Wir erwarten 2 Routen, da die Weiterleitungen (redirects) ohne title-Data gefiltert werden sollten
    expect(items.length).toBe(2);
    
    expect(items[0]).toEqual({ path: '/anmeldungen', title: 'Anmeldungen', icon: 'bi-people-fill' });
    expect(items[1]).toEqual({ path: '/management', title: 'Management', icon: 'bi-gear-fill' });
  });

  it('should render a navigation link for each menu item', () => {
    const navLinks = spectator.queryAll('.nav-link');
    
    expect(navLinks.length).toBe(2);
    expect(navLinks[0].textContent?.trim()).toContain('Anmeldungen');
    expect(navLinks[1].textContent?.trim()).toContain('Management');
  });
});