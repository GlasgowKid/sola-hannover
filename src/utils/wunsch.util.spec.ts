import { GroupMember } from './ct-types';
import { buildWunschClusters, getWunsch, getWunschStatus } from './wunsch.util';

describe('Wunsch Utility', () => {
  const ctUrlPrefix = 'https://sola-hannover.church.tools/?q=churchdb#PersonView/searchEntry:%23';

  // Hilfsfunktion zum Erstellen eines GroupMembers für die Tests
  const createMockMember = (id: number, firstName: string, lastName: string, fields: { name: string; value: any }[] = []): GroupMember => {
    return {
      id,
      person: {
        domainAttributes: { firstName, lastName },
        frontendUrl: `${ctUrlPrefix}${id}`
      },
      fields
    } as unknown as GroupMember;
  };

  const participantList = [
    createMockMember(99, 'Anna', 'Müller'),
    createMockMember(100, 'Ben', 'Bäcker')
  ];

  describe('getWunsch', () => {
    it('sollte null zurückgeben, wenn das Feld nicht existiert', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', []);
      expect(getWunsch(member, 'Wunsch 1', participantList)).toBeNull();
    });

    it('sollte null zurückgeben, wenn das Feld existiert, aber keinen Wert hat', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [{ name: 'Wunsch 1', value: null }]);
      expect(getWunsch(member, 'Wunsch 1', participantList)).toBeNull();
    });

    it('sollte den Status "ignored" zurückgeben, wenn der Wert auf "(ignoriert)" endet', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [{ name: 'Wunsch 1', value: 'Tim (ignoriert)' }]);
      const result = getWunsch(member, 'Wunsch 1', participantList);

      expect(result).toEqual({ text: 'Tim', status: 'ignored' });
    });

    it('sollte den Status "ignored" auch bei abweichender Groß-/Kleinschreibung von "(ignoriert)" erkennen', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [{ name: 'Wunsch 1', value: 'Tim (IGNORIERT)' }]);
      const result = getWunsch(member, 'Wunsch 1', participantList);

      expect(result).toEqual({ text: 'Tim', status: 'ignored' });
    });

    it('sollte den Status "confirmed" und den Namen zurückgeben, wenn es ein valider ChurchTools Link ist', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [{ name: 'Wunsch 1', value: `${ctUrlPrefix}99` }]);
      const result = getWunsch(member, 'Wunsch 1', participantList);

      expect(result).toEqual({ text: 'Anna Müller', status: 'confirmed', matchedPersonId: 99 });
    });

    it('sollte "Unbekannter Link" als "confirmed" zurückgeben, wenn der Link nicht in der Teilnehmerliste ist', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [{ name: 'Wunsch 1', value: `${ctUrlPrefix}999` }]);
      const result = getWunsch(member, 'Wunsch 1', participantList);

      expect(result).toEqual({ text: 'Unbekannter Link', status: 'confirmed' });
    });

    it('sollte den Status "open" für normalen Freitext zurückgeben', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [{ name: 'Wunsch 1', value: 'Ich möchte mit Tim in ein Zelt' }]);
      const result = getWunsch(member, 'Wunsch 1', participantList);

      expect(result).toEqual({ text: 'Ich möchte mit Tim in ein Zelt', status: 'open' });
    });
  });

  describe('getWunschStatus', () => {
    it('sollte "keine" zurückgeben, wenn keine Wünsche existieren', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', []);
      expect(getWunschStatus(member, participantList)).toBe('keine');
    });

    it('sollte "keine" zurückgeben, wenn Wünsche leer sind', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [
        { name: 'Wunsch 1', value: '' },
        { name: 'Wunsch 2', value: null }
      ]);
      expect(getWunschStatus(member, participantList)).toBe('keine');
    });

    it('sollte "zugeordnet" zurückgeben, wenn nur ein Wunsch existiert und dieser bestätigt ist', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [
        { name: 'Wunsch 1', value: `${ctUrlPrefix}99` }
      ]);
      expect(getWunschStatus(member, participantList)).toBe('zugeordnet');
    });

    it('sollte "zugeordnet" zurückgeben, wenn beide Wünsche bestätigt sind', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [
        { name: 'Wunsch 1', value: `${ctUrlPrefix}99` },
        { name: 'Wunsch 2', value: `${ctUrlPrefix}100` }
      ]);
      expect(getWunschStatus(member, participantList)).toBe('zugeordnet');
    });

    it('sollte "ignoriert" zurückgeben, wenn nur ein Wunsch existiert und dieser ignoriert ist', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [
        { name: 'Wunsch 1', value: 'Tim (ignoriert)' }
      ]);
      expect(getWunschStatus(member, participantList)).toBe('ignoriert');
    });

    it('sollte "ignoriert" zurückgeben, wenn beide Wünsche ignoriert sind', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [
        { name: 'Wunsch 1', value: 'Tim (ignoriert)' },
        { name: 'Wunsch 2', value: 'Tom (ignoriert)' }
      ]);
      expect(getWunschStatus(member, participantList)).toBe('ignoriert');
    });

    it('sollte "teilweise" zurückgeben, wenn ein Wunsch bestätigt und einer ignoriert ist', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [
        { name: 'Wunsch 1', value: `${ctUrlPrefix}99` },
        { name: 'Wunsch 2', value: 'Tom (ignoriert)' }
      ]);
      expect(getWunschStatus(member, participantList)).toBe('teilweise');
    });

    it('sollte "teilweise" zurückgeben, wenn ein Wunsch bestätigt und einer offen ist', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [
        { name: 'Wunsch 1', value: `${ctUrlPrefix}99` },
        { name: 'Wunsch 2', value: 'Tom' }
      ]);
      expect(getWunschStatus(member, participantList)).toBe('teilweise');
    });

    it('sollte "teilweise" zurückgeben, wenn ein Wunsch ignoriert und einer offen ist', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [
        { name: 'Wunsch 1', value: 'Tim (ignoriert)' },
        { name: 'Wunsch 2', value: 'Tom' }
      ]);
      expect(getWunschStatus(member, participantList)).toBe('teilweise');
    });

    it('sollte "teilweise" zurückgeben, wenn alle vorhandenen Wünsche offen sind', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [
        { name: 'Wunsch 1', value: 'Tim' },
        { name: 'Wunsch 2', value: 'Tom' }
      ]);
      expect(getWunschStatus(member, participantList)).toBe('teilweise');
    });

    it('sollte "teilweise" zurückgeben, wenn nur ein Wunsch existiert und dieser offen ist', () => {
      const member = createMockMember(1, 'Max', 'Mustermann', [
        { name: 'Wunsch 1', value: 'Tim' }
      ]);
      expect(getWunschStatus(member, participantList)).toBe('teilweise');
    });
  });

  describe('buildWunschClusters', () => {
    it('sollte zusammenhängende Wunschgruppen bilden', () => {
      const p1 = createMockMember(1, 'A', 'A', [{ name: 'Wunsch 1', value: `${ctUrlPrefix}2` }]);
      const p2 = createMockMember(2, 'B', 'B', [{ name: 'Wunsch 1', value: `${ctUrlPrefix}3` }]);
      const p3 = createMockMember(3, 'C', 'C', []);
      const p4 = createMockMember(4, 'D', 'D', []);
      const p5 = createMockMember(5, 'E', 'E', [{ name: 'Wunsch 2', value: `${ctUrlPrefix}6` }]);
      const p6 = createMockMember(6, 'F', 'F', []);

      const elementsToCluster = [p1, p2, p3, p4, p5, p6];

      const { clusters, withoutGroup } = buildWunschClusters(elementsToCluster, elementsToCluster);

      expect(clusters.length).toBe(2);
      expect(clusters[0].map(m => m.id)).toEqual([1, 2, 3]);
      expect(clusters[1].map(m => m.id)).toEqual([5, 6]);

      expect(withoutGroup.length).toBe(1);
      expect(withoutGroup[0].id).toBe(4);
    });

    it('sollte Personen nicht in die Gruppe aufnehmen, wenn sie nicht im Cluster-Fokus liegen (z.B. schon in Stamm verschoben)', () => {
      const p1 = createMockMember(1, 'A', 'A', [{ name: 'Wunsch 1', value: `${ctUrlPrefix}2` }]);
      const p2 = createMockMember(2, 'B', 'B', []);

      const { clusters, withoutGroup } = buildWunschClusters([p1], [p1, p2]);

      expect(clusters.length).toBe(0);
      expect(withoutGroup.length).toBe(1);
      expect(withoutGroup[0].id).toBe(1);
    });
  });
});