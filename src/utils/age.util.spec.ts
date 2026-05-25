import { getMemberAge, getMemberBirthday } from './age.util';
import { GroupMember } from './ct-types';

describe('Age Utility', () => {
  beforeAll(() => {
    // Wir setzen eine feste Systemzeit, damit die Altersberechnungen deterministisch sind
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-05-25T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('getMemberBirthday', () => {
    it('sollte das Geburtsdatum aus personFields.birthday zurückgeben', () => {
      const member = { personFields: { birthday: '2010-01-01' }, person: {} } as unknown as GroupMember;
      expect(getMemberBirthday(member)).toBe('2010-01-01');
    });

    it('sollte das Geburtsdatum aus person.birthday zurückgeben', () => {
      const member = { person: { birthday: '2011-02-02' } } as unknown as GroupMember;
      expect(getMemberBirthday(member)).toBe('2011-02-02');
    });

    it('sollte das Geburtsdatum aus person.domainAttributes.birthday zurückgeben', () => {
      const member = { person: { domainAttributes: { birthday: '2012-03-03' } } } as unknown as GroupMember;
      expect(getMemberBirthday(member)).toBe('2012-03-03');
    });

    it('sollte null zurückgeben, wenn kein Geburtsdatum gefunden wird', () => {
      const member = { person: { domainAttributes: {} } } as GroupMember;
      expect(getMemberBirthday(member)).toBeNull();
    });
  });

  describe('getMemberAge', () => {
    it('sollte das korrekte Alter berechnen, wenn der Geburtstag im aktuellen Jahr bereits war', () => {
      const member = { personFields: { birthday: '2010-05-15' }, person: {} } as unknown as GroupMember;
      expect(getMemberAge(member)).toBe(14); // 2024 - 2010 = 14
    });

    it('sollte das korrekte Alter berechnen, wenn der Geburtstag im aktuellen Jahr noch nicht war', () => {
      const member = { personFields: { birthday: '2010-06-15' }, person: {} } as unknown as GroupMember;
      expect(getMemberAge(member)).toBe(13); // Wird erst im Juni 14
    });

    it('sollte null zurückgeben, wenn kein oder ein ungültiges Geburtsdatum vorhanden ist', () => {
      expect(getMemberAge({ person: {} } as unknown as GroupMember)).toBeNull();
      expect(getMemberAge({ personFields: { birthday: 'invalid-date' }, person: {} } as unknown as GroupMember)).toBeNull();
    });

    it('sollte null zurückgeben, wenn das berechnete Alter <= 0 ist (z.B. falsches Datum oder Baby)', () => {
      const member = { personFields: { birthday: '2024-06-15' }, person: {} } as unknown as GroupMember;
      expect(getMemberAge(member)).toBeNull(); // Alter wäre 0 oder -1
    });
  });
});