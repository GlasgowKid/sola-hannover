import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { GroupMember } from '../utils/ct-types';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('sola-hannover');
  groupMembers = signal<GroupMember[]>([]);

  ngOnInit(): void {
    const baseUrl = environment.ctBaseUrl;
    churchtoolsClient.setBaseUrl(baseUrl);

    const username = environment.ctUsername;
    const password = environment.ctPassword;

    churchtoolsClient.post('/login', { username, password }).then((login) => {
      churchtoolsClient.get<GroupMember[]>(`/groups/32/members`).then(groupMembers => {
        this.groupMembers.set(groupMembers);
      });
    });

  }
}
