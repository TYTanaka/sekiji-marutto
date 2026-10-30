import type { Guest, TableDef, Assignments, AppState } from '../types';

type AssignmentResult = { ok: true } | { ok: false; reason: string };

function guestAssignment(assignments: Assignments, guestId: string) {
  return assignments[guestId];
}

function findTable(state: AppState, tableId: string): TableDef | undefined {
  return state.tables.find((table) => table.id === tableId);
}

export function seatPosition(
  index: number,
  total: number,
): { x: number; y: number } {
  const angle = (total > 0 ? (index / total) * 2 * Math.PI : 0) - Math.PI / 2;

  return {
    x: Math.round((50 + 38 * Math.cos(angle)) * 100) / 100,
    y: Math.round((50 + 38 * Math.sin(angle)) * 100) / 100,
  };
}

export function assignedGuestAt(
  state: AppState,
  tableId: string,
  seatIndex: number,
): Guest | undefined {
  return state.guests.find((guest) => {
    const assignment = guestAssignment(state.assignments, guest.id);
    return (
      assignment?.tableId === tableId &&
      assignment.seatIndex === seatIndex
    );
  });
}

export function isSeatTaken(
  state: AppState,
  tableId: string,
  seatIndex: number,
): boolean {
  return Object.values(state.assignments).some(
    (assignment) =>
      assignment?.tableId === tableId &&
      assignment.seatIndex === seatIndex,
  );
}

export function unassignedAttending(state: AppState): Guest[] {
  return state.guests.filter(
    (guest) =>
      guest.rsvp === 'attending' &&
      guestAssignment(state.assignments, guest.id) == null,
  );
}

export function validateAssignment(
  state: AppState,
  guestId: string,
  tableId: string,
  seatIndex: number,
): AssignmentResult {
  const guest = state.guests.find((candidate) => candidate.id === guestId);

  if (!guest) {
    return { ok: false, reason: 'Guest not found.' };
  }

  if (guest.rsvp !== 'attending') {
    return { ok: false, reason: 'Guest is not attending.' };
  }

  const table = findTable(state, tableId);

  if (!table) {
    return { ok: false, reason: 'Table not found.' };
  }

  if (
    !Number.isInteger(seatIndex) ||
    seatIndex < 0 ||
    seatIndex >= table.seats
  ) {
    return { ok: false, reason: 'Seat index is out of range.' };
  }

  const takenByAnotherGuest = Object.entries(state.assignments).some(
    ([assignedGuestId, assignment]) =>
      assignedGuestId !== guestId &&
      assignment?.tableId === tableId &&
      assignment.seatIndex === seatIndex,
  );

  if (takenByAnotherGuest) {
    return { ok: false, reason: 'Seat is taken by another guest.' };
  }

  return { ok: true };
}

export function tableFill(
  state: AppState,
  tableId: string,
): { seated: number; seats: number } {
  const table = findTable(state, tableId);

  if (!table) {
    return { seated: 0, seats: 0 };
  }

  const occupiedSeats = new Set<number>();

  for (const assignment of Object.values(state.assignments)) {
    if (
      assignment?.tableId === tableId &&
      Number.isInteger(assignment.seatIndex) &&
      assignment.seatIndex >= 0 &&
      assignment.seatIndex < table.seats
    ) {
      occupiedSeats.add(assignment.seatIndex);
    }
  }

  return { seated: occupiedSeats.size, seats: table.seats };
}
