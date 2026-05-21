import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { SofaAnmeldungenComponent, SofaAnmeldungViewModel } from './sofa-anmeldungen.component';
import { MemberStatus } from '../../../utils/ct-enums';
import { GroupMember } from '../../../utils/ct-types';
import { MemberUpdatePayload } from '../anmeldungen/anmeldungen.component';

const createMockMember = (id: number, status: MemberStatus, birthday: string | null, fields: any[] = []): GroupMember => ({
  id,
  personId: id * 10,
  groupMemberStatus: status,
  personFields: { birthday },
  fields
} as any);

describe('SofaAnmeldungenComponent', () => {
  let spectator: Spectator<SofaAnmeldungenComponent>;

  const createComponent = createComponentFactory({
    component: SofaAnmeldungenComponent,
    shallow: true,
  });

  beforeEach(() => {
    spectator = createComponent({
      props: {
        anmeldungen: [],
        priceRefDate: new Date('2024-07-01T00:00:00Z'),
        updateProgress: 0,
      }
    });
  });

  it('should create the component', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('should handle empty anmeldungen and reset states', () => {
    let emittedData: SofaAnmeldungViewModel[] | undefined;
    spectator.component.processedData.subscribe(data => emittedData = data);

    spectator.setInput('anmeldungen', []);
    spectator.component.ngOnChanges();

    expect(spectator.component.$isFamiliensola()).toBe(false);
    expect(spectator.component.$internalData()).toEqual([]);
    expect(emittedData).toEqual([]);
  });

  describe('calculateFamilienpreis', () => {
    it('should calculate price for a single adult correctly', () => {
      const member = createMockMember(1, MemberStatus.ACTIVE, '1990-01-01'); // 34 Jahre alt in 2024

      spectator.setInput('anmeldungen', [member]);
      spectator.component.ngOnChanges();

      const preis = spectator.component.$internalData()[0].familienpreis;
      expect(preis.personenAnzahlAb13).toBe(1);
      expect(preis.personenAnzahl5Bis12).toBe(0);
      expect(preis.anzahlFamilienmitglieder).toBe(1);
      expect(preis.gesamt).toBe(200); // 80 Basis + 120 Erwachsener
    });

    it('should calculate price for a family with children and dogs and set $isFamiliensola', () => {
      const member = createMockMember(1, MemberStatus.ACTIVE, '1980-01-01', [
        { name: 'Vorname Familienmitglied 2', value: 'Kind1' },
        { name: 'Nachname Familienmitglied 2', value: 'Muster' },
        { name: 'Geburtstag Familienmitglied 2', value: '2015-05-05' }, // 9 Jahre alt -> 5-12 Jahre
        { name: 'Hunde', value: '2' }
      ]);

      spectator.setInput('anmeldungen', [member]);
      spectator.component.ngOnChanges();

      expect(spectator.component.$isFamiliensola()).toBe(true);
      
      const preis = spectator.component.$internalData()[0].familienpreis;
      expect(preis.anzahlFamilienmitglieder).toBe(2);
      expect(preis.personenAnzahlAb13).toBe(1);
      expect(preis.personenAnzahl5Bis12).toBe(1);
      expect(preis.anzahlHunde).toBe(2);
      // Basis (80) + Erwachsener (120) + Kind (80) + 2x Hund (40) = 320
      expect(preis.gesamt).toBe(320); 
      expect(preis.weitereMitglieder[0].vorname).toBe('Kind1');
    });

    it('should not charge for babies under 5 years', () => {
      const member = createMockMember(1, MemberStatus.ACTIVE, '1980-01-01', [
        { name: 'Vorname Familienmitglied 2', value: 'Baby' },
        { name: 'Geburtstag Familienmitglied 2', value: '2022-01-01' } // Unter 5 Jahre alt
      ]);

      spectator.setInput('anmeldungen', [member]);
      spectator.component.ngOnChanges();

      const preis = spectator.component.$internalData()[0].familienpreis;
      expect(preis.personenAnzahlAb13).toBe(1);
      expect(preis.personenAnzahl5Bis12).toBe(0);
      expect(preis.gesamt).toBe(200); // Nur Basis (80) + Erwachsener (120) = 200
    });

    it('should mark invalid if birthday is missing or malformed', () => {
      const m1 = createMockMember(1, MemberStatus.ACTIVE, 'not-a-date');
      const m2 = createMockMember(2, MemberStatus.ACTIVE, null);
      const m3 = createMockMember(3, MemberStatus.ACTIVE, '1990-01-01', [
        { name: 'Hunde', value: 'Zwei' } // Ungültige Hunde-Anzahl (NaN)
      ]);

      spectator.setInput('anmeldungen', [m1, m2, m3]);
      spectator.component.ngOnChanges();

      const data = spectator.component.$internalData();
      expect(data[0].familienpreis.invalid).toBe(true);
      expect(data[1].familienpreis.invalid).toBe(true);
      expect(data[2].familienpreis.invalid).toBe(true);
    });
  });

  describe('Filtering and Payloads', () => {
    it('should filter displayFields correctly to hide extra family members in UI', () => {
      const member = createMockMember(1, MemberStatus.ACTIVE, '1990-01-01', [
        { name: 'Allergien', value: 'Nüsse', sortKey: 1 },
        { name: 'Vorname Familienmitglied 2', value: 'Kind', sortKey: 2 },
      ]);

      spectator.setInput('anmeldungen', [member]);
      spectator.component.ngOnChanges();

      const data = spectator.component.$internalData()[0];
      expect(data.displayFields.length).toBe(1);
      expect(data.displayFields[0].name).toBe('Allergien');
    });

    it('should generate payloads for REQUESTED members and emit them', () => {
      const m1 = createMockMember(1, MemberStatus.REQUESTED, '1990-01-01');
      const m2 = createMockMember(2, MemberStatus.ACTIVE, '1990-01-01'); // ACTIVE wird vom Payload ignoriert

      spectator.setInput('anmeldungen', [m1, m2]);
      spectator.component.ngOnChanges();

      let emittedPayloads: MemberUpdatePayload[] | undefined;
      spectator.component.updateRequested.subscribe(p => emittedPayloads = p);

      // Überprüfung der generierten Payloads und unsavedIds Signal
      expect(spectator.component.$unsavedIds()).toEqual([1]);

      spectator.component.emitUpdate();

      expect(emittedPayloads).toBeDefined();
      expect(emittedPayloads!.length).toBe(1);
      expect(emittedPayloads![0].member.id).toBe(1);
      expect(emittedPayloads![0].updates[0].fieldName).toBe('familienpreis');
      expect(emittedPayloads![0].updates[0].value).toBe(200); // 80 Basis + 120 Erwachsener
    });

    it('should only generate unsaved payloads for members whose calculated Familienpreis differs from the existing one', () => {
      spectator.setInput('priceRefDate', new Date('2024-07-01T00:00:00Z'));
      
      spectator.setInput('anmeldungen', [
        createMockMember(1, MemberStatus.REQUESTED, '2015-01-01', [{ name: 'Familienpreis', value: '160' }]), // Identisch -> überspringen
        createMockMember(2, MemberStatus.REQUESTED, '2010-01-01', [{ name: 'Familienpreis', value: '100' }]), // Falscher Wert -> Payload generieren
        createMockMember(3, MemberStatus.REQUESTED, '2015-01-01', []) // Noch gar kein Wert -> Payload generieren
      ]);
      spectator.component.ngOnChanges();

      const payloads = spectator.component.$unsavedPayloads();
      expect(payloads.length).toBe(2);
      
      expect(payloads[0].member.id).toBe(2);
      expect(payloads[0].updates).toEqual([{ fieldName: 'familienpreis', value: 200 }]);
      
      expect(payloads[1].member.id).toBe(3);
      expect(payloads[1].updates).toEqual([{ fieldName: 'familienpreis', value: 160 }]);
    });
  });
});
