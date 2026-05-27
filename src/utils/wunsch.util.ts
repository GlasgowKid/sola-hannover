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

export function buildWunschClusters(elementsToCluster: GroupMember[], allParticipants: GroupMember[]): { clusters: GroupMember[][], withoutGroup: GroupMember[] } {
  const visited = new Set<number>();
  const adj = new Map<number, Set<number>>();

  elementsToCluster.forEach(p => adj.set(p.id, new Set()));

  elementsToCluster.forEach(p => {
    const w1 = getWunsch(p, 'Wunsch 1', allParticipants);
    const w2 = getWunsch(p, 'Wunsch 2', allParticipants);

    [w1, w2].forEach(w => {
      if (w?.status === 'confirmed' && w.matchedPersonId !== undefined) {
        if (adj.has(w.matchedPersonId)) {
          adj.get(p.id)!.add(w.matchedPersonId);
          adj.get(w.matchedPersonId)!.add(p.id); // ungerichteter Graph
        }
      }
    });
  });

  const clusters: GroupMember[][] = [];
  const withoutGroup: GroupMember[] = [];

  elementsToCluster.forEach(p => {
    if (!visited.has(p.id)) {
      const component: GroupMember[] = [];
      const queue = [p.id];
      visited.add(p.id);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const member = elementsToCluster.find(m => m.id === current);
        if (member) component.push(member);

        adj.get(current)?.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }

      if (component.length > 1) {
        component.sort((a, b) => elementsToCluster.indexOf(a) - elementsToCluster.indexOf(b));
        clusters.push(component);
      } else {
        withoutGroup.push(...component);
      }
    }
  });

  return { clusters, withoutGroup };
}