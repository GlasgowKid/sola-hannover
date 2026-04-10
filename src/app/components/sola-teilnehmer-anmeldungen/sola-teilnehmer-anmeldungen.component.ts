import { Component, OnChanges, TemplateRef, ViewChild, input, signal } from '@angular/core';
import { GroupMember } from '../../../utils/ct-types';
import { KeyValuePipe } from '@angular/common';

export interface WunschStatus {
  hasWunsch: boolean;
  allFound: boolean;
  wuensche: Map<string, GroupMember[]>;
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
        wuensche: new Map<string, GroupMember[]>(),
      };

      let w1Success = true;
      let w2Success = true;

      if (w1Text) {
        const matches = this.findMatches(w1Text, row.personId, allMembers);
        status.wuensche.set(w1Text, matches);
        w1Success = matches.length === 1;
      }

      if (w2Text) {
        const matches = this.findMatches(w2Text, row.personId, allMembers);
        status.wuensche.set(w2Text, matches);
        w2Success = matches.length === 1;
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

  private findMatches(wunschStr: string, currentPersonId: number, allMembers: GroupMember[]): GroupMember[] {
    const wunschTokens = this.tokenizeText(wunschStr);
    if (wunschTokens.length === 0) return [];

    return allMembers.filter(candidate => {
      if (candidate.personId === currentPersonId) return false;

      const first = candidate.person?.domainAttributes?.firstName || '';
      const last = candidate.person?.domainAttributes?.lastName || '';
      const candidateTokens = this.tokenizeText(`${first} ${last}`);

      return wunschTokens.every(wunschWort => candidateTokens.includes(wunschWort));
    });
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