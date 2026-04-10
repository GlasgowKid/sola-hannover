import { Component, OnChanges, TemplateRef, ViewChild, input, signal } from '@angular/core';
import { GroupMember } from '../../../utils/ct-types';
import { KeyValuePipe } from '@angular/common';

export interface WunschMatch {
  members: GroupMember[];
  isExact: boolean;
}

export interface WunschStatus {
  hasWunsch: boolean;
  allFound: boolean;
  wuensche: Map<string, WunschMatch>;
}

@Component({
  selector: 'app-sola-teilnehmer-anmeldungen',
  standalone: true,
  imports: [KeyValuePipe],
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
      const w1Text = this.extractField(row, 'Wunsch 1');
      const w2Text = this.extractField(row, 'Wunsch 2');

      const status: WunschStatus = {
        hasWunsch: !!(w1Text || w2Text),
        allFound: false,
        wuensche: new Map<string, WunschMatch>(),
      };

      let w1Success = true;
      let w2Success = true;

      if (w1Text) {
        const matchResult = this.findMatches(w1Text, row.personId, allMembers);
        status.wuensche.set(w1Text, matchResult);
        w1Success = matchResult.members.length === 1 && matchResult.isExact;
      }

      if (w2Text) {
        const matchResult = this.findMatches(w2Text, row.personId, allMembers);
        status.wuensche.set(w2Text, matchResult);
        w2Success = matchResult.members.length === 1 && matchResult.isExact;
      }

      status.allFound = status.hasWunsch && w1Success && w2Success;
      resultMap.set(row.id, status);
    }

    this.$wuenscheMap.set(resultMap);
  }

  private extractField(row: GroupMember, fieldName: string): string | null {
    const field = row.fields.find(f => f.name === fieldName);
    const val = field?.value ? String(field.value).trim() : '';
    return val !== '' ? val : null;
  }

  private findMatches(wunschStr: string, currentPersonId: number, allMembers: GroupMember[]): WunschMatch {
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
}