import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { map, mergeMap, of, switchMap } from 'rxjs';
import { Group } from '../../../utils/ct-types';
import { ChurchtoolsService } from '../../services/churchtools.service';

@Component({
  selector: 'app-anmeldungen',
  imports: [CommonModule],
  templateUrl: './anmeldungen.component.html',
  styleUrl: './anmeldungen.component.scss',
})
export class AnmeldungenComponent {
  private readonly churchToolsService = inject(ChurchtoolsService);
  groupTypes$ = this.churchToolsService.getGroupTypes();
  jahre$ = this.churchToolsService.getJahre();
  groupMembers$ = this.churchToolsService.getUsersFromGroup(32);

  solawochen$ = this.jahre$.pipe(
    mergeMap(jahre => jahre.reduce(
      (result$, jahr) => result$.pipe(
        switchMap(result => this.churchToolsService.getSolawochen(jahr.id).pipe(
          map(solawochen => {
            console.log({ result, solawochen })
            result.set(jahr, solawochen);
            return result;
          })
        ))
      ),
      of(new Map<Group, Group[]>)
    ))
  );

  getAge(birthday: string | unknown): number | string {
    if (typeof birthday !== 'string') return '';

    const birthDate = new Date(birthday);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  getExtraField(member: any, fieldName: string): string {
    if (!member.fields) return '';
    const field = member.fields.find((f: any) => f.name === fieldName);
    return field ? field.value : '';
  }
  
  getPersonField(member: any, key: string): any {
    return member.personFields ? (member.personFields as any)[key] : null;
  }
}
