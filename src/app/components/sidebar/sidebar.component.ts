import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { routes } from '../../app.routes';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  styleUrl: './sidebar.component.scss',
  host: {
    'class': 'text-white bg-secondary p-2 shadow d-flex flex-column align-items-center flex-shrink-0 overflow-y-auto'
  },
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent {
  readonly menuItems = routes
    .filter(route => route.data && route.data['title'])
    .map(route => ({
      path: '/' + route.path,
      title: route.data!['title'],
    }));
}