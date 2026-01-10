import { Injectable } from '@angular/core';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { BehaviorSubject, forkJoin, from, map, mergeMap, Observable, of, ReplaySubject, switchMap, take } from 'rxjs';
import { environment } from '../../environments/environment.development';
import { DomainObjectGroup, Group, GroupMember, GroupType } from '../../utils/ct-types';

@Injectable({
  providedIn: 'root',
})
export class ChurchtoolsService {
  private loggedIn$ = new BehaviorSubject<boolean>(false);
  private groupTypes$ = new ReplaySubject<GroupType[]>(1);

  constructor() {
    const baseUrl = environment.ctBaseUrl;
    churchtoolsClient.setBaseUrl(baseUrl);

    const username = environment.ctUsername;
    const password = environment.ctPassword;

    churchtoolsClient.post('/login', { username, password }).then(() => {
      this.loggedIn$.next(true);
      churchtoolsClient.get<GroupType[]>(`/group/grouptypes`).then(groupTypes => this.groupTypes$.next(groupTypes));
    });
  }

  getGroupTypes(): Observable<GroupType[]> {
    return this.groupTypes$.asObservable();
  }

  groupTypeFilter(typeName: string): Observable<Record<string, any>> {
    return this.groupTypes$.pipe(
      map((groupTypes) => groupTypes.find(gt => gt.name === typeName)),
      map((gt) => gt && ({ group_type_ids: [gt.id] }) || ({}))
    );
  }

  getJahre(): Observable<Group[]> {
    return this.groupTypeFilter("Jahr").pipe(
      switchMap(params => from(churchtoolsClient.get<Group[]>("/groups", params)))
    );
  }

  getSolawochen(yearGroupId?: number): Observable<Group[]> {
    if (yearGroupId) {
      return this.groupTypeFilter("Solawoche").pipe(
        switchMap(params => from(churchtoolsClient.get<DomainObjectGroup[]>(`/groups/${yearGroupId}/children`, params))),
        map(dogs => dogs.map(dog => dog.domainIdentifier)),
        switchMap(ids => ids.length > 0 ? from(churchtoolsClient.get<Group[]>(`/groups`, { ids })) : of([])),
      );
    } else {
      return this.groupTypeFilter("Solawoche").pipe(
        switchMap(params => from(churchtoolsClient.get<Group[]>("/groups", params))),
        take(1)
      );
    }
  }

  getAnmeldungen(groupId: number): Observable<GroupMember[]> {
    const params = { personFields: ["birthday", "sexId"] };
    return this.loggedIn$.pipe(
      switchMap(
        (loggedIn) => loggedIn 
          ? from(churchtoolsClient.get<GroupMember[]>(`/groups/${groupId}/members`, params))
          : of([])
      )
    );
  }
}
