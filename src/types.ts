export type Side = 'groom' | 'bride';

export type GuestGroup = 'family' | 'work' | 'friends' | 'other';

export type RsvpStatus = 'pending' | 'attending' | 'declined';

export interface Guest {
  id: string;
  name: string;
  title: string;
  side: Side;
  group: GuestGroup;
  rsvp: RsvpStatus;
  allergy: string;
  memo: string;
  companions: number;
}

export interface TableDef {
  id: string;
  name: string;
  seats: number;
}

export interface WeddingInfo {
  groomName: string;
  brideName: string;
  date: string;
  venue: string;
  message: string;
}

export type Assignments = Record<
  string,
  { tableId: string; seatIndex: number }
>;

export interface AppState {
  version: number;
  guests: Guest[];
  tables: TableDef[];
  assignments: Assignments;
  info: WeddingInfo;
}

export const GROUP_LABELS: Record<GuestGroup, string> = {
  family: '親族',
  work: '会社',
  friends: '友人',
  other: 'その他',
};

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: '未回答',
  attending: '出席',
  declined: '欠席',
};

export const SIDE_LABELS: Record<Side, string> = {
  groom: '新郎側',
  bride: '新婦側',
};
