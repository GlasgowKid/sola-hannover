import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { BsModalService } from 'ngx-bootstrap/modal';
import { of } from 'rxjs';
import { ChurchtoolsService } from '../../services/churchtools.service';
import { StammesEinteilungComponent, SortOption } from './stammes-einteilung.component';

describe('StammesEinteilungComponent', () => {
  let spectator: Spectator<StammesEinteilungComponent>;

  const mockChurchtoolsService = {
    getGroupTypes: jest.fn().mockReturnValue(of([])),
    getJahre: jest.fn().mockReturnValue(of([])),
    getSolawochen: jest.fn().mockReturnValue(of([])),
    getTeilnehmer: jest.fn().mockReturnValue(of([])),
    getGroupRoles: jest.fn().mockReturnValue(of([])),
  };

  const createComponent = createComponentFactory({
    component: StammesEinteilungComponent,
    shallow: false,
    providers: [
      { provide: ChurchtoolsService, useValue: mockChurchtoolsService },
      { provide: BsModalService, useValue: { show: jest.fn() } }
    ]
  });

  beforeEach(() => {
    spectator = createComponent();
    // 3 Test-Teilnehmer (unsortiert)
    spectator.component.$anmeldungen.set([
      { id: 2, personId: 102, person: { domainAttributes: { firstName: 'B', lastName: 'X' } } } as any,
      { id: 1, personId: 101, person: { domainAttributes: { firstName: 'A', lastName: 'A' } } } as any,
      { id: 3, personId: 103, person: { domainAttributes: { firstName: 'C', lastName: 'Z' } } } as any
    ]);
    (spectator.component as any).originalLoadedCount = 3;
  });

  it('Regel 1: Main (Alle Teilnehmer) sortiert alphabetisch und löst Gruppen/Pools auf', () => {
    const ev = new Event('drop') as DragEvent;
    ev.preventDefault = jest.fn();
    ev.stopPropagation = jest.fn();

    spectator.component.draggedPayload = {
      type: 'POOL',
      sourceZone: 'pool-0',
      data: [spectator.component.$anmeldungen()[0], spectator.component.$anmeldungen()[1]]
    };
    spectator.component.onDrop(ev, 'main');

    const main = spectator.component.$anmeldungen();
    expect(main.length).toBe(3);
    expect(main[0].person.domainAttributes.lastName).toBe('A');
    expect(main[1].person.domainAttributes.lastName).toBe('X');
    expect(main[2].person.domainAttributes.lastName).toBe('Z');
  });

  it('Regel 2: Stämme machen Pools zu Gruppen, behalten Gruppen, lösen 1-Element-Pools auf', () => {
    const ev = new Event('drop') as DragEvent;
    ev.preventDefault = jest.fn();
    ev.stopPropagation = jest.fn();

    const p0 = spectator.component.$anmeldungen()[0];
    const p1 = spectator.component.$anmeldungen()[1];
    const p2 = spectator.component.$anmeldungen()[2];

    // Pool (p0, p1) -> Stamm 0 (wird zur Gruppe)
    spectator.component.draggedPayload = { type: 'POOL', sourceZone: 'pool-0', data: [p0, p1] };
    spectator.component.onDrop(ev, 'stamm-0');

    expect(spectator.component.$staemme()[0].length).toBe(1);
    expect((spectator.component.$staemme()[0][0] as any).isWrapper).toBe(true);

    // Pool (p2) -> Stamm 1 (Löst sich auf da nur 1 Element)
    spectator.component.draggedPayload = { type: 'POOL', sourceZone: 'pool-1', data: [p2] };
    spectator.component.onDrop(ev, 'stamm-1');
    expect(spectator.component.$staemme()[1].length).toBe(1);
    expect((spectator.component.$staemme()[1][0] as any).isWrapper).toBeFalsy(); // Einzelteilnehmer
  });

  it('Regel 3: Pools lösen reinkommende Gruppen auf', () => {
    const ev = new Event('drop') as DragEvent;
    ev.preventDefault = jest.fn();
    ev.stopPropagation = jest.fn();

    const testGroup = { id: 'group1', isWrapper: true, participants: [spectator.component.$anmeldungen()[0], spectator.component.$anmeldungen()[1]] };

    spectator.component.draggedPayload = { type: 'GROUP', sourceZone: 'stamm-0', data: testGroup };
    spectator.component.onDrop(ev, 'pool-0');

    const pool0 = spectator.component.$pools()[0];
    expect(pool0.participants.length).toBe(2);
    expect((pool0.participants[0] as any).isWrapper).toBeFalsy(); // aufgelöst zu Einzelteilnehmern
  });

  it('Regel 4: Ein Verschieben innerhalb eines Stamms oder innerhalb eines Pools ist nicht möglich', () => {
    const ev = new Event('drop') as DragEvent;
    ev.preventDefault = jest.fn();
    ev.stopPropagation = jest.fn();

    spectator.component.draggedPayload = { type: 'PARTICIPANT', sourceZone: 'stamm-0', data: spectator.component.$anmeldungen()[0] };
    spectator.component.onDrop(ev, 'stamm-0');

    // Die preventDefault etc. dürfen nicht aufgerufen worden sein, da abgebrochen wird
    expect(ev.preventDefault).not.toHaveBeenCalled();

    spectator.component.draggedPayload = { type: 'PARTICIPANT', sourceZone: 'pool-1', data: spectator.component.$anmeldungen()[0] };
    spectator.component.onDrop(ev, 'pool-1');
    expect(ev.preventDefault).not.toHaveBeenCalled();
  });

  it('Regel 5: Neue Einträge werden immer an das Ende eines Stamms oder eines Pools eingefügt', () => {
    const ev = new Event('drop') as DragEvent;
    ev.preventDefault = jest.fn();
    ev.stopPropagation = jest.fn();

    const p0 = spectator.component.$anmeldungen()[0];
    const p1 = spectator.component.$anmeldungen()[1];

    // Erstes Element in Stamm 0
    spectator.component.draggedPayload = { type: 'PARTICIPANT', sourceZone: 'main', data: p0 }; // Person X
    spectator.component.onDrop(ev, 'stamm-0');

    // Zweites Element in Stamm 0
    spectator.component.draggedPayload = { type: 'PARTICIPANT', sourceZone: 'main', data: p1 }; // Person A
    spectator.component.onDrop(ev, 'stamm-0');

    expect(spectator.component.$staemme()[0].length).toBe(2);
    expect(spectator.component.$staemme()[0][1].id).toBe(p1.id); // Person A ist am Ende
  });

  it('Regel 6: X-Button löscht das Element aus allen Zonen und legt es alphabetisch in Main', () => {
    const ev = new Event('drop') as DragEvent;
    ev.preventDefault = jest.fn();
    ev.stopPropagation = jest.fn();

    // Wir verschieben A in Pool 0
    const personA = spectator.component.$anmeldungen()[1];
    spectator.component.draggedPayload = { type: 'PARTICIPANT', sourceZone: 'main', data: personA };
    spectator.component.onDrop(ev, 'pool-0');

    expect(spectator.component.$pools()[0].participants.length).toBe(1);
    expect(spectator.component.$anmeldungen().length).toBe(2);

    spectator.component.resetParticipant(personA);

    expect(spectator.component.$pools()[0].participants.length).toBe(0);
    const main = spectator.component.$anmeldungen();
    expect(main.length).toBe(3);
    // Wieder alphabetisch
    expect(main[0].person.domainAttributes.lastName).toBe('A');
    expect(main[1].person.domainAttributes.lastName).toBe('X');
    expect(main[2].person.domainAttributes.lastName).toBe('Z');
  });

  it('Regel 7: Gruppen mit nur 1 Mitglied werden im Stamm nach dem Drop automatisch zu Einzelteilnehmern aufgelöst', () => {
    const ev = new Event('drop') as DragEvent;
    ev.preventDefault = jest.fn();
    ev.stopPropagation = jest.fn();

    // Wir manipulieren den Stamm 0 so, dass er eine Gruppe mit 1 Person enthält
    const personA = spectator.component.$anmeldungen()[1];

    // WICHTIG: PersonA aus Main entfernen, damit der State nicht korrupt ist (Geister-Duplikat)!
    spectator.component.$anmeldungen.update(list => list.filter(p => p.id !== personA.id));

    spectator.component.$staemme.set([
      [{ id: 'wrapper-1', isWrapper: true, participants: [personA] } as any],
      [], [], [], [], [], [], []
    ]);

    // Wir lösen einen Drop aus, um die Bereinigung (Regel 7) zu triggern
    spectator.component.draggedPayload = { type: 'PARTICIPANT', sourceZone: 'main', data: spectator.component.$anmeldungen()[0] };
    spectator.component.onDrop(ev, 'stamm-1');

    const stamm0 = spectator.component.$staemme()[0];
    expect(stamm0.length).toBe(1);
    expect((stamm0[0] as any).isWrapper).toBeFalsy();
    expect(stamm0[0].id).toBe(personA.id);
  });

  it('Regel 8: Jede Teilnehmer-ID ist nach einem Drag & Drop Vorgang immer nur einmal vorhanden (Deduplizierung)', () => {
    const ev = new Event('drop') as DragEvent;
    ev.preventDefault = jest.fn();
    ev.stopPropagation = jest.fn();

    // Wir pushen Person A manuell in Pool 0, aber lassen sie auch in Main
    spectator.component.$pools.update(pools => {
      pools[0].participants.push(spectator.component.$anmeldungen()[1]);
      return pools;
    });

    // Nun ziehen wir Person A aus Pool 0 in Stamm 0
    // Dabei sollte sie aus Main entfernt werden! (Deduplizierung in onDrop)
    spectator.component.draggedPayload = { type: 'PARTICIPANT', sourceZone: 'pool-0', data: spectator.component.$anmeldungen()[1] };
    spectator.component.onDrop(ev, 'stamm-0');

    // Sie darf nun nur noch in Stamm 0 sein
    expect(spectator.component.$anmeldungen().find(p => p.id === 1)).toBeUndefined();
    expect(spectator.component.$pools()[0].participants.length).toBe(0);
    expect(spectator.component.$staemme()[0].length).toBe(1);
    expect(spectator.component.$staemme()[0][0].id).toBe(1);
  });

  it('Regel 9: Verschiebe ich eine Gruppe (mehrere Personen) habe ich eine Hand als Mauscursor (cursor-grab), verschiebe ich einen Einzelteilnehmer habe ich ein Doppelkreuz (cursor-move)', () => {
    spectator.component.$staemme.set([
      [{ id: 'wrapper-1', isWrapper: true, participants: [spectator.component.$anmeldungen()[0], spectator.component.$anmeldungen()[1]] } as any],
      [], [], [], [], [], [], []
    ]);
    spectator.detectChanges();

    // Einzelteilnehmer in Main
    const participantCard = spectator.query('.participant-card');
    expect(participantCard).toHaveClass('cursor-move');

    // Stamm Gruppe Wrapper
    const stammGroupCard = spectator.query('.group-body .group-wrapper-card');
    expect(stammGroupCard).toHaveClass('cursor-grab');

    // Pool Wrapper
    const poolWrapper = spectator.query('.pool-wrappers .group-wrapper-card');
    expect(poolWrapper).toHaveClass('cursor-grab');
  });

  describe('Zusätzliche Logik & Edge Cases', () => {
    it('Validation schlägt an bei Complex Drag and Drop Scenarios (Geister-Duplikaten)', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const modalSpy = jest.spyOn((spectator.component as any).modalService, 'show');
      const loadSpy = jest.spyOn(spectator.component, 'loadGroupsServer').mockImplementation();

      // Wir legen manuell ein Duplikat an, um den State zu beschädigen
      spectator.component.$pools.update(ps => {
        ps[0].participants.push(spectator.component.$anmeldungen()[0]);
        return ps;
      });

      expect(() => (spectator.component as any).validateState()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Zustand korrupt'), expect.any(Object));
      expect(modalSpy).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    });

    it('Filter logic (filteredParticipants) filtert korrekt nach Text und Geschlecht', () => {
      spectator.component.$anmeldungen.set([
        { id: 1, personFields: { sexId: 1 }, person: { domainAttributes: { firstName: 'Max', lastName: 'Mustermann' } } } as any,
        { id: 2, personFields: { sexId: 2 }, person: { domainAttributes: { firstName: 'Anna', lastName: 'Schmidt' } } } as any,
      ]);

      // Kein Filter
      expect(spectator.component.filteredParticipants().length).toBe(2);

      // Textfilter
      spectator.component.searchTerm.set('max');
      expect(spectator.component.filteredParticipants().length).toBe(1);
      expect(spectator.component.filteredParticipants()[0].id).toBe(1);

      spectator.component.searchTerm.set('');

      // Geschlechtsfilter (Jungs = 1)
      spectator.component.activeFilter.set({ type: 'gender', value: 1 });
      expect(spectator.component.filteredParticipants().length).toBe(1);
      expect(spectator.component.filteredParticipants()[0].id).toBe(1);

      // Geschlechtsfilter (Mädchen = 2)
      spectator.component.activeFilter.set({ type: 'gender', value: 2 });
      expect(spectator.component.filteredParticipants().length).toBe(1);
      expect(spectator.component.filteredParticipants()[0].id).toBe(2);
    });

    it('Sort logic (filteredParticipants) sortiert korrekt nach aktiver Sortierung', () => {
      spectator.component.$anmeldungen.set([
        { id: 2, person: { birthday: '2010-01-01', domainAttributes: { firstName: 'Max', lastName: 'Mustermann' } } } as any,
        { id: 1, person: { birthday: '2012-01-01', domainAttributes: { firstName: 'Anna', lastName: 'Schmidt' } } } as any,
        { id: 3, person: { birthday: '2008-01-01', domainAttributes: { firstName: 'Zeta', lastName: 'Aal' } } } as any,
      ]);

      spectator.component.activeSort.set(SortOption.LastNameAsc);
      let result = spectator.component.filteredParticipants();
      expect(result[0].id).toBe(3);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(1);

      spectator.component.activeSort.set(SortOption.FirstNameAsc);
      result = spectator.component.filteredParticipants();
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(3);

      spectator.component.activeSort.set(SortOption.AgeAsc);
      result = spectator.component.filteredParticipants();
      expect(result[0].id).toBe(1); // 2012
      expect(result[1].id).toBe(2); // 2010
      expect(result[2].id).toBe(3); // 2008

      spectator.component.activeSort.set(SortOption.IdDesc);
      result = spectator.component.filteredParticipants();
      expect(result[0].id).toBe(3);
      expect(result[1].id).toBe(2);
      expect(result[2].id).toBe(1);
    });

    it('loadGroupsServer ordnet Teilnehmer korrekt aus ChurchTools in Stämme und Main ein', async () => {
      // Setup mock data from server
      const p1 = { id: 1, fields: [{ name: 'Stammeszugehörigkeit', value: 'Stamm 1' }], person: { domainAttributes: { firstName: 'A', lastName: 'A' } } } as any;
      const p2 = { id: 2, fields: [{ name: 'Gruppenzugehörigkeit', value: 'Stamm 8' }], person: { domainAttributes: { firstName: 'B', lastName: 'B' } } } as any;
      const p3 = { id: 3, fields: [{ name: 'Stammeszugehörigkeit', value: null }], person: { domainAttributes: { firstName: 'C', lastName: 'C' } } } as any;

      // Simulieren, dass eine Woche ausgewählt ist und der Service die Daten zurückgibt
      spectator.component.selectedWeek.set(123);
      jest.spyOn((spectator.component as any).churchToolsService, 'getTeilnehmer').mockReturnValue(of([p1, p2, p3]));

      await spectator.component.loadGroupsServer();

      expect(spectator.component.$staemme()[0].length).toBe(1); // Stamm 1
      expect(spectator.component.$staemme()[0][0].id).toBe(1);

      expect(spectator.component.$staemme()[7].length).toBe(1); // Stamm 8
      expect(spectator.component.$staemme()[7][0].id).toBe(2);

      expect(spectator.component.$anmeldungen().length).toBe(1); // Main
      expect(spectator.component.$anmeldungen()[0].id).toBe(3);
    });

    it('sollte isDragging bei onDragStart aus main setzen und bei onDragEnd zurücksetzen', () => {
      const ev = new Event('dragstart') as DragEvent;
      spectator.component.onDragStart(ev, { type: 'PARTICIPANT', sourceZone: 'main', data: spectator.component.$anmeldungen()[0] });
      expect(spectator.component.isDragging()).toBe(true);
      spectator.component.onDragEnd();
      expect(spectator.component.isDragging()).toBe(false);
    });

    it('sollte is-dragging-container Klasse setzen, wenn isDragging true ist, um Layout-Jumps zu verhindern', () => {
      const container = spectator.query('.container-fluid');
      expect(container).not.toHaveClass('is-dragging-container');
      
      const ev = new Event('dragstart') as DragEvent;
      spectator.component.onDragStart(ev, { type: 'PARTICIPANT', sourceZone: 'main', data: spectator.component.$anmeldungen()[0] });
      spectator.detectChanges();
      expect(spectator.query('.container-fluid')).toHaveClass('is-dragging-container');
      
      spectator.component.onDragEnd();
      spectator.detectChanges();
      expect(spectator.query('.container-fluid')).not.toHaveClass('is-dragging-container');
    });

    it('sollte isDragging NICHT setzen, wenn der Drag in einem Pool startet', () => {
      const ev = new Event('dragstart') as DragEvent;
      spectator.component.onDragStart(ev, { type: 'PARTICIPANT', sourceZone: 'pool-0', data: spectator.component.$anmeldungen()[0] });
      expect(spectator.component.isDragging()).toBe(false);
    });

    describe('Neues Feature: Ganzen Stamm verschieben', () => {
      beforeEach(() => {
        const p1 = spectator.component.$anmeldungen()[0]; // B.X
        const p2 = spectator.component.$anmeldungen()[1]; // A.A
        const p3 = spectator.component.$anmeldungen()[2]; // C.Z
        
        spectator.component.$anmeldungen.set([]);
        const testGroup = { id: 'group1', isWrapper: true, participants: [p1, p2] };
        // Wir haben in Stamm 0 eine Gruppe und einen Einzelteilnehmer
        spectator.component.$staemme.set([ [testGroup as any, p3], [], [], [], [], [], [], [] ]);
      });

      it('sollte einen ganzen Stamm in die Teilnehmerliste verschieben und Gruppen auflösen', () => {
        const ev = new Event('drop') as DragEvent; ev.preventDefault = jest.fn(); ev.stopPropagation = jest.fn();
        spectator.component.draggedPayload = { type: 'STAMM', sourceZone: 'stamm-0', data: spectator.component.$staemme()[0] };
        
        spectator.component.onDrop(ev, 'main');
        
        expect(spectator.component.$staemme()[0].length).toBe(0);
        expect(spectator.component.$anmeldungen().length).toBe(3);
        // Alphabetische Sortierung muss nach dem Entpacken greifen! (A, X, Z)
        expect(spectator.component.$anmeldungen()[0].person.domainAttributes.lastName).toBe('A');
        expect(spectator.component.$anmeldungen()[1].person.domainAttributes.lastName).toBe('X');
      });

      it('sollte einen ganzen Stamm in einen Poolbereich verschieben und Gruppen auflösen', () => {
        const ev = new Event('drop') as DragEvent; ev.preventDefault = jest.fn(); ev.stopPropagation = jest.fn();
        spectator.component.draggedPayload = { type: 'STAMM', sourceZone: 'stamm-0', data: spectator.component.$staemme()[0] };
        
        spectator.component.onDrop(ev, 'pool-1');
        
        expect(spectator.component.$staemme()[0].length).toBe(0);
        expect(spectator.component.$pools()[1].participants.length).toBe(3);
        // Wrapper müssen aufgelöst worden sein
        expect((spectator.component.$pools()[1].participants[0] as any).isWrapper).toBeFalsy();
      });

      it('sollte einen ganzen Stamm in einen anderen Stamm verschieben und Gruppen beibehalten', () => {
        const ev = new Event('drop') as DragEvent; ev.preventDefault = jest.fn(); ev.stopPropagation = jest.fn();
        spectator.component.draggedPayload = { type: 'STAMM', sourceZone: 'stamm-0', data: spectator.component.$staemme()[0] };
        
        spectator.component.onDrop(ev, 'stamm-2');
        
        expect(spectator.component.$staemme()[0].length).toBe(0);
        expect(spectator.component.$staemme()[2].length).toBe(2); // Gruppe + Einzelteilnehmer
        expect((spectator.component.$staemme()[2][0] as any).isWrapper).toBe(true);
        expect(spectator.component.$staemme()[2][1].id).toBe(3);
      });
    });
  });
});
