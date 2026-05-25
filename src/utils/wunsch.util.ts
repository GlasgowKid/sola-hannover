import { GroupMember } from './ct-types';

export interface WunschAnzeige {
  text: string;
  status: 'open' | 'ignored' | 'confirmed';
  matchedPersonId?: number;
}

export function getWunsch(member: GroupMember, fieldName: string, allParticipants: GroupMember[]): WunschAnzeige | null {
  const field = member.fields?.find(f => f.name === fieldName);
  if (!field || !field.value) return null;
  const val = String(field.value).trim();

  if (val.toLowerCase().endsWith('(ignoriert)')) {
    return { text: val.substring(0, val.length - 11).trim(), status: 'ignored' };
  }

  if (val.startsWith('https://sola-hannover.church.tools/?q=churchdb#PersonView/searchEntry:%23')) {
    const matched = allParticipants.find(m => m.person?.frontendUrl === val);
    if (matched) {
      return {
        text: `${matched.person.domainAttributes.firstName} ${matched.person.domainAttributes.lastName}`.trim(),
        status: 'confirmed',
        matchedPersonId: matched.id
      };
    }
    return { text: 'Unbekannter Link', status: 'confirmed' };
  }

  return { text: val, status: 'open' };
}

export type WunschStatusType = 'zugeordnet' | 'teilweise' | 'ignoriert' | 'keine';

export function getWunschStatus(member: GroupMember, allParticipants: GroupMember[]): WunschStatusType {
  const wunsch1 = getWunsch(member, 'Wunsch 1', allParticipants);
  const wunsch2 = getWunsch(member, 'Wunsch 2', allParticipants);
  const wuensche = [wunsch1, wunsch2].filter((w): w is WunschAnzeige => w !== null);

  if (wuensche.length === 0) {
    return 'keine';
  }

  const statuses = wuensche.map(w => w.status);

  if (statuses.every(s => s === 'confirmed')) { return 'zugeordnet'; }
  if (statuses.every(s => s === 'ignored')) { return 'ignoriert'; }

  return 'teilweise';
}