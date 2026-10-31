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

/** 本人＋同伴者の人数（同伴者は本人の隣の席に座る前提で数える） */
export function partySize(guest: Guest): number {
  return 1 + Math.max(0, guest.companions ?? 0);
}

export interface SeatOccupant {
  guest: Guest;
  /** 本人の席ではなく、同伴者用の席かどうか */
  companion: boolean;
}

/** 指定席を占有しているゲスト（同伴者席は本人を返す） */
export function seatOccupant(
  state: AppState,
  tableId: string,
  seatIndex: number,
): SeatOccupant | undefined {
  for (const guest of state.guests) {
    const assignment = guestAssignment(state.assignments, guest.id);
    if (assignment?.tableId !== tableId) continue;
    const offset = seatIndex - assignment.seatIndex;
    if (offset === 0) return { guest, companion: false };
    if (offset > 0 && offset < partySize(guest)) {
      return { guest, companion: true };
    }
  }
  return undefined;
}

export function assignedGuestAt(
  state: AppState,
  tableId: string,
  seatIndex: number,
): Guest | undefined {
  return seatOccupant(state, tableId, seatIndex)?.guest;
}

export function isSeatTaken(
  state: AppState,
  tableId: string,
  seatIndex: number,
): boolean {
  return seatOccupant(state, tableId, seatIndex) !== undefined;
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

  const size = partySize(guest);

  if (seatIndex + size - 1 >= table.seats) {
    return {
      ok: false,
      reason: 'Companion seats do not fit at this seat position.',
    };
  }

  for (let offset = 0; offset < size; offset += 1) {
    const occupant = seatOccupant(state, tableId, seatIndex + offset);
    if (occupant && occupant.guest.id !== guestId) {
      return { ok: false, reason: 'Seat is taken by another guest.' };
    }
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

  let seated = 0;
  for (const guest of state.guests) {
    const assignment = guestAssignment(state.assignments, guest.id);
    if (assignment?.tableId === tableId) {
      seated += partySize(guest);
    }
  }

  return { seated, seats: table.seats };
}
