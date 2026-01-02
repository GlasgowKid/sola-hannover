import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { GroupMember } from '../utils/ct-types';

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
    const baseUrl = "";
    churchtoolsClient.setBaseUrl(baseUrl);

    const username = "";
    const password = "";

    churchtoolsClient.post('/login', { username, password }).then((login) => {
      churchtoolsClient.get<GroupMember[]>(`/groups/32/members`).then(groupMembers => {
        this.groupMembers.set(groupMembers);
      });
    });

  }
}
