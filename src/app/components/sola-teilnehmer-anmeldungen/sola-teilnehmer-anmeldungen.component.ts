import { PercentPipe } from '@angular/common';
import { Component, OnChanges, TemplateRef, ViewChild, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GroupMember, GroupMemberFieldGroup } from '../../../utils/ct-types';
import { ChurchtoolsService } from '../../services/churchtools.service';

export interface WunschMatch {
  text: string;
  rawValue: string;
  members: GroupMember[];
  isExact: boolean;
}

export interface WunschStatus {
  hasWunsch: boolean;
  allFound: boolean;
  wuensche: WunschMatch[];
}

@Component({
  selector: 'app-sola-teilnehmer-anmeldungen',
  standalone: true,
  imports: [PercentPipe],
  templateUrl: './sola-teilnehmer-anmeldungen.component.html',
  styleUrl: './sola-teilnehmer-anmeldungen.component.scss',
})
export class SolaTeilnehmerAnmeldungenComponent implements OnChanges {
  @ViewChild('wuenscheSpalte') wuenscheSpalte?: TemplateRef<{ row: GroupMember }>;
  @ViewChild('wuenscheDetails') wuenscheDetails?: TemplateRef<{ row: GroupMember }>;

  readonly anmeldungen = input.required<GroupMember[]>();
  readonly isFamiliensola = input.required<boolean>();
  readonly $showWuensche = signal(false);
  readonly $wuenscheMap = signal<Map<number, WunschStatus>>(new Map());
  readonly groupId = input.required<number | null>();
  readonly $progress = signal<number>(0);
  private readonly churchToolsService = inject(ChurchtoolsService);
  readonly $errorIds = signal<number[]>([]);

  ngOnChanges() {
    const raw = this.anmeldungen();
    if (!raw || raw.length === 0) {
      this.$showWuensche.set(false);
      this.$wuenscheMap.set(new Map());
      return;
    }

    const isMitarbeiter = raw.some(m => m.fields.some(f => f.name === 'MA-Rolle' && f.value));
    const show = this.isFamiliensola() === false && !isMitarbeiter;

    this.$showWuensche.set(show);

    if (show) {
      this.calculateWunschMatches(raw);
    }
  }

  private calculateWunschMatches(allMembers: GroupMember[]) {
    const resultMap = new Map<number, WunschStatus>();

    for (const row of allMembers) {
      const w1Match = this.processWunschField(row, 'Wunsch 1', allMembers);
      const w2Match = this.processWunschField(row, 'Wunsch 2', allMembers);

      const status: WunschStatus = {
        hasWunsch: !!(w1Match || w2Match),
        allFound: false,
        wuensche: [],
      };

      let w1Success = true;
      let w2Success = true;

      if (w1Match) {
        status.wuensche.push(w1Match);
        w1Success = w1Match.members.length === 1 && w1Match.isExact;
      }

      if (w2Match) {
        status.wuensche.push(w2Match);
        w2Success = w2Match.members.length === 1 && w2Match.isExact;
      }

      status.allFound = status.hasWunsch && w1Success && w2Success;
      resultMap.set(row.id, status);
    }

    this.$wuenscheMap.set(resultMap);
  }

  private processWunschField(row: GroupMember, fieldName: string, allMembers: GroupMember[]): WunschMatch | null {
    const field = row.fields.find(f => f.name === fieldName);
    const rawValue = field?.value ? String(field.value).trim() : '';
    if (!rawValue) return null;

    if (this.isAlreadyUrl(rawValue)) {
      const matchedMember = allMembers.find(m => m.person?.frontendUrl === rawValue);      
      if (matchedMember) {
        const first = matchedMember.person?.domainAttributes?.firstName || '';
        const last = matchedMember.person?.domainAttributes?.lastName || '';
        return {
          text: `${first} ${last}`.trim(),
          rawValue,
          members: [matchedMember],
          isExact: true,
        };
      }
    }

    const matchResult = this.findMatches(rawValue, row.personId, allMembers);
    return {
      text: rawValue,
      rawValue,
      members: matchResult.members,
      isExact: matchResult.isExact
    };
  }

  private findMatches(wunschStr: string, currentPersonId: number, allMembers: GroupMember[]): { members: GroupMember[], isExact: boolean } {
    const wunschTokens = this.tokenizeText(wunschStr);
    if (wunschTokens.length === 0) return { members: [], isExact: false };

    const exactMatches = allMembers.filter(candidate => {
      if (candidate.personId === currentPersonId) return false;
      const first = candidate.person?.domainAttributes?.firstName || '';
      const last = candidate.person?.domainAttributes?.lastName || '';
      const candidateTokens = this.tokenizeText(`${first} ${last}`);
      return wunschTokens.every(wunschWort => candidateTokens.includes(wunschWort));
    });

    if (exactMatches.length > 0) {
      return { members: exactMatches, isExact: true };
    }

    const fuzzyMatches = allMembers.filter(candidate => {
      if (candidate.personId === currentPersonId) return false;
      const first = candidate.person?.domainAttributes?.firstName || '';
      const last = candidate.person?.domainAttributes?.lastName || '';
      const candidateTokens = this.tokenizeText(`${first} ${last}`);

      return wunschTokens.every(wunschWort => {
        return candidateTokens.some(candidateToken => this.isFuzzyMatch(wunschWort, candidateToken));
      });
    });

    return { members: fuzzyMatches, isExact: false };
  }

  private isFuzzyMatch(a: string, b: string): boolean {
    const dist = this.levenshtein(a, b);
    // Bei kurzen Wörtern (<=4) erlauben wir 1 Fehler, bei längeren Wörtern 2 Fehler
    const maxTolerance = a.length <= 4 ? 1 : 2;
    return dist <= maxTolerance;
  }

  private levenshtein(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array.from({ length: b.length + 1 }, () => new Array(a.length + 1).fill(0));
    for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  private tokenizeText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ß/g, 'ss')
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[,.-]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  private performSingleUpdate(groupId: number, anmeldung: GroupMember, updates: { fieldDef: GroupMemberFieldGroup, value: string }[]): Promise<GroupMember> {
    let fields = [...anmeldung.fields];
    
    for (const u of updates) {
      fields = fields.filter(f => f.id !== u.fieldDef.id); 
      fields.push({ id: u.fieldDef.id, name: u.fieldDef.name, value: u.value, sortKey: u.fieldDef.sortKey }); 
    }

    return firstValueFrom(
      this.churchToolsService.updateGroupMember(groupId, anmeldung.personId, { fields })
    );
  }

  async updateWuensche() {
    const groupId = this.groupId();
    if (!groupId || this.$progress() > 0) return;

    try {
      const fields = await firstValueFrom(this.churchToolsService.getGroupMemberFields(groupId));
      const w1FieldDef = fields?.find(f => f.name === "Wunsch 1");
      const w2FieldDef = fields?.find(f => f.name === "Wunsch 2");

      if (!w1FieldDef && !w2FieldDef) return;

      const rawMembers = this.anmeldungen();
      const toUpdate: { member: GroupMember, updates: { fieldDef: GroupMemberFieldGroup, value: string }[] }[] = [];

      for (const member of rawMembers) {
        const status = this.$wuenscheMap().get(member.id);
        if (!status) continue;

        const updates: { fieldDef: GroupMemberFieldGroup, value: string }[] = [];

        const w1Match = status.wuensche[0];
        if (w1Match && w1FieldDef && w1Match.members.length === 1 && w1Match.isExact && !this.isAlreadyUrl(w1Match.rawValue)) {
          updates.push({ fieldDef: w1FieldDef, value: w1Match.members[0].person?.frontendUrl });
        }

        const w2Match = status.wuensche[1];
        if (w2Match && w2FieldDef && w2Match.members.length === 1 && w2Match.isExact && !this.isAlreadyUrl(w2Match.rawValue)) {
          updates.push({ fieldDef: w2FieldDef, value: w2Match.members[0].person?.frontendUrl });
        }

        if (updates.length > 0) {
          toUpdate.push({ member, updates });
        }
      }

      if (toUpdate.length === 0) return;

      this.$progress.set(0.01);

      for (const [index, item] of toUpdate.entries()) {
        try {
          const updatedMember = await this.performSingleUpdate(groupId, item.member, item.updates);
          item.member.fields = updatedMember.fields;
        } catch (err) {
          console.error(`Fehler ID ${item.member.id}`, err);
          this.$errorIds.update(ids => [...ids, item.member.id]);
        }
        this.$progress.set((index + 1) / toUpdate.length);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      this.calculateWunschMatches(rawMembers);
    } catch (err) {
      console.error("Globaler Fehler", err);
    } finally {
      setTimeout(() => this.$progress.set(0), 500);
    }
  }

  private isAlreadyUrl(val: string): boolean {
    return val.startsWith('https://sola-hannover.church.tools/?q=churchdb#PersonView/searchEntry:%23');
  }
}