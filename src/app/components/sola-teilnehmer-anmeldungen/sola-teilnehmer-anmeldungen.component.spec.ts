import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { SolaTeilnehmerAnmeldungenComponent } from './sola-teilnehmer-anmeldungen.component';
import { BsModalService, ModalModule } from 'ngx-bootstrap/modal';
import { NgxDatatableModule } from '@siemens/ngx-datatable';
import { PercentPipe } from '@angular/common';
import { GroupMember } from '../../../utils/ct-types';

const createMockMember = (id: number, firstName: string, lastName: string, wunsch1?: string, wunsch2?: string, isMa = false, url?: string): GroupMember => ({
  id,
  personId: id * 10,
  person: {
    id: id * 10,
    domainAttributes: { firstName, lastName },
    frontendUrl: url || `https://example.com/?q=churchdb#PersonView/searchEntry:%23${id * 10}`
  },
  personFields: { sexId: 1, zip: '12345', city: 'TestCity' },
  fields: [
    ...(wunsch1 ? [{ name: 'Wunsch 1', value: wunsch1 }] : []),
    ...(wunsch2 ? [{ name: 'Wunsch 2', value: wunsch2 }] : []),
    ...(isMa ? [{ name: 'MA-Rolle', value: 'Leiter' }] : [])
  ]
} as any);

describe('SolaTeilnehmerAnmeldungenComponent', () => {
  let spectator: Spectator<SolaTeilnehmerAnmeldungenComponent>;

  const createComponent = createComponentFactory({
    component: SolaTeilnehmerAnmeldungenComponent,
    imports: [ModalModule.forRoot(), NgxDatatableModule, PercentPipe],
    declarations: [],
    mocks: [BsModalService],
  });

  beforeEach(() => {
    spectator = createComponent({
      props: {
        anmeldungen: [],
        isFamiliensola: false,
        updateProgress: 0,
      },
    });
  });

  it('should create the component', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('should hide wuensche if isFamiliensola is true', () => {
    spectator.setInput('isFamiliensola', true);
    spectator.component.ngOnChanges();
    
    expect(spectator.component.$showWuensche()).toBe(false);
  });

  it('should format search queries correctly and remove special characters', () => {
    spectator.component.searchQuery.set('Müller-Lüdenscheid, Max!');
    
    const query = spectator.component.searchQuery().toLowerCase().replace(/[^\p{L}\d\s]/gu, ' ').trim();
    expect(query).toBe('müller lüdenscheid  max');
  });

  describe('Wunsch Matching Logic', () => {
    it('should hide wuensche if a member is MA-Rolle', () => {
      const m1 = createMockMember(1, 'Max', 'Muster', undefined, undefined, true);
      spectator.setInput('anmeldungen', [m1]);
      spectator.component.ngOnChanges();

      expect(spectator.component.$showWuensche()).toBe(false);
    });

    it('should find exact matches and set WunschStatus correctly', () => {
      const m1 = createMockMember(1, 'Anton', 'Müller', 'Berta Meyer');
      const m2 = createMockMember(2, 'Berta', 'Meyer');

      spectator.setInput('anmeldungen', [m1, m2]);
      spectator.component.ngOnChanges();

      const status = spectator.component.$wuenscheMap().get(1);
      expect(status?.hasWunsch).toBe(true);
      expect(status?.allFound).toBe(true);
      expect(status?.allSaved).toBe(false); // Because it is just a text match, not a URL yet
      expect(status?.wuensche[0].isExact).toBe(true);
    });

    it('should find fuzzy matches and set WunschStatus correctly', () => {
      const m1 = createMockMember(1, 'Anton', 'Müller', 'Bertha Meier');
      const m2 = createMockMember(2, 'Berta', 'Meyer'); // Levenshtein dist: 2 (h->'', a->e)

      spectator.setInput('anmeldungen', [m1, m2]);
      spectator.component.ngOnChanges();

      const status = spectator.component.$wuenscheMap().get(1);
      expect(status?.hasWunsch).toBe(true);
      expect(status?.allFound).toBe(false); // Fuzzy match is not "found" until confirmed
      expect(status?.wuensche[0].isExact).toBe(false);
      expect(status?.wuensche[0].members[0].id).toBe(2);
    });

    it('should recognize already saved URLs', () => {
      const targetUrl = 'https://sola-hannover.church.tools/?q=churchdb#PersonView/searchEntry:%2320';
      const m1 = createMockMember(1, 'Anton', 'Müller', targetUrl);
      const m2 = createMockMember(2, 'Berta', 'Meyer', undefined, undefined, false, targetUrl);

      spectator.setInput('anmeldungen', [m1, m2]);
      spectator.component.ngOnChanges();

      const status = spectator.component.$wuenscheMap().get(1);
      expect(status?.allSaved).toBe(true);
    });
  });

  describe('Modal and Manual Zuweisung', () => {
    it('should handle manual search clearing candidates', () => {
      spectator.component.resolveState.set({ rowId: 1, fieldName: 'Wunsch 1', candidates: [createMockMember(2, 'a', 'b')], selected: [] });
      spectator.component.enableManualSearch();
      
      expect(spectator.component.resolveState()?.candidates.length).toBe(0);
    });

    it('should confirm modal selection and update the WunschStatus map', () => {
      const m1 = createMockMember(1, 'Anton', 'Müller', 'Bertha');
      const m2 = createMockMember(2, 'Berta', 'Meyer');
      
      spectator.setInput('anmeldungen', [m1, m2]);
      spectator.component.ngOnChanges(); // Trigger initial fuzzy match

      // Open modal
      spectator.component.openResolveModal({} as any, 1, 'Wunsch 1', [m2]);
      
      // Select the fuzzy match
      spectator.component.onCandidateSelect({ selected: [m2] });
      spectator.component.confirmModalSelection(); // Confirm

      const status = spectator.component.$wuenscheMap().get(1);
      expect(status?.wuensche[0].isManuallyConfirmed).toBe(true);
      expect(status?.hasManual).toBe(true);
      expect(status?.allFound).toBe(true);
    });
  });

  describe('Outputs and Filtering', () => {
    it('should compute $unsavedPayloads and emit them on emitUpdate', () => {
      const m1 = createMockMember(1, 'Anton', 'Müller', 'Berta Meyer');
      const m2 = createMockMember(2, 'Berta', 'Meyer');

      spectator.setInput('anmeldungen', [m1, m2]);
      spectator.component.ngOnChanges(); // Sets allFound = true

      let emittedPayload: any;
      spectator.output('updateRequested').subscribe(payload => emittedPayload = payload);

      expect(spectator.component.$unsavedIds()).toEqual([1]);
      
      spectator.component.emitUpdate();
      
      expect(emittedPayload).toBeDefined();
      expect(emittedPayload.length).toBe(1);
      expect(emittedPayload[0].member.id).toBe(1);
      expect(emittedPayload[0].updates[0].fieldName).toBe('Wunsch 1');
      expect(emittedPayload[0].updates[0].value).toBe(m2.person.frontendUrl);
    });

    it('should correctly sort rows using wuenscheComparator', () => {
      const m1 = createMockMember(1, 'Anton', 'A', 'Offen'); // Status: 1 (allFound = false)
      const m2 = createMockMember(2, 'Berta', 'B'); // Status: 5 (hasWunsch = false)
      
      spectator.setInput('anmeldungen', [m1, m2]);
      spectator.component.ngOnChanges();

      // Offene Wünsche (1) sollten vor keinen Wünschen (5) kommen
      const result = spectator.component.wuenscheComparator('id', 'id', m1, m2);
      expect(result).toBeLessThan(0); // 1 - 5 = -4
    });

    it('should correctly fallback to name sorting in wuenscheComparator', () => {
      const m1 = createMockMember(1, 'Anton', 'A'); 
      const m2 = createMockMember(2, 'Berta', 'B');
      
      spectator.setInput('anmeldungen', [m1, m2]);
      spectator.component.ngOnChanges();

      // Beide haben Status 5 (kein Wunsch), also wird nach Name sortiert
      const result = spectator.component.wuenscheComparator('id', 'id', m1, m2);
      expect(result).toBeLessThan(0); 
    });

    it('should handle modal filter state and getFilteredRows caching', () => {
      const m1 = createMockMember(1, 'Anton', 'Müller', 'Hans'); // Offen
      const rows = [m1];
      
      spectator.setInput('anmeldungen', rows);
      spectator.component.ngOnChanges();

      // Initiale Filter lassen alle durch
      expect(spectator.component.getFilteredRows(rows).length).toBe(1);

      // Filter im pending State ändern
      spectator.component.toggleFilter('offen', false);
      spectator.component.applyWuenscheFilterAndSort();

      // Filter sollte nun greifen
      expect(spectator.component.getFilteredRows(rows).length).toBe(0);
    });
  });
});
