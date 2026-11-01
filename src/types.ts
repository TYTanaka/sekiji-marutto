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
  inviteToken: string;
  /** 招待リンクを最初に開いた日時（ISO）。ローカルモードで記録される */
  openedAt?: string;
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

export interface PrepTask {
  id: string;
  title: string;
  /** 挙式日からの相対期日（ISO日付）。未設定も可 */
  dueDate?: string;
  done: boolean;
}

export interface AppState {
  version: number;
  /** 端末内キーの分離に使う、その式のための不変ID（表示情報の編集では変わらない） */
  localId?: string;
  guests: Guest[];
  tables: TableDef[];
  assignments: Assignments;
  info: WeddingInfo;
  tasks: PrepTask[];
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
