import { getWunsch, getWunschStatus, WunschAnzeige } from './wunsch.util';
import { GroupMember } from './ct-types';

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
});