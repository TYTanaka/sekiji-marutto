import type { AppState, Guest, GuestGroup, Side } from '../types';
import { createDefaultTasks } from './tasks';
import { proposeAssignments } from './autoSeat';

const SURNAMES = [
  '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤',
  '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '清水', '山崎',
  '森', '池田', '橋本', '阿部', '石川', '山下', '中島', '石井', '小川', '前田',
];

const GIVEN: [string, string][] = [
  ['健太', '美咲'], ['翔太', '彩香'], ['大輔', '真由'], ['直樹', '千尋'],
  ['拓也', '由紀'], ['悠介', '恵子'], ['誠', '陽子'], ['隆', '智子'],
];

const GROUPS: GuestGroup[] = ['family', 'work', 'friends', 'other', 'work', 'friends'];

const TITLES: Record<GuestGroup, string[]> = {
  family: ['叔父', '叔母', 'いとこ', '祖父', '祖母', '兄', '姉'],
  work: ['上司（部長）', '先輩', '同僚', '後輩', '上司（課長）', '同僚'],
  friends: ['高校時代の友人', '大学時代の友人', 'サークルの友人', '中学時代の友人'],
  other: ['恩師（先生）', '近所の方', '両親の友人', '習い事の先生'],
};

const ALLERGIES = ['甲殻類', '卵', '乳製品', 'そば', 'ナッツ類'];

/**
 * 大規模披露宴（120名・15卓）の検証用サンプル。
 * 乱数を使わず決定的に生成する（テストで再現可能にするため）。
 * 出席者は全員、自動配置の提案で席に収まるよう構成している。
 */
export function createLargeSeedState(): AppState {
  const guests: Guest[] = [];
  for (let i = 0; i < 120; i += 1) {
    const side: Side = i % 2 === 0 ? 'groom' : 'bride';
    const group = GROUPS[i % GROUPS.length];
    const surname = SURNAMES[i % SURNAMES.length];
    const givenPair = GIVEN[Math.floor(i / SURNAMES.length) % GIVEN.length];
    const given = side === 'groom' ? givenPair[0] : givenPair[1];
    const relation = TITLES[group][i % TITLES[group].length];
    const rsvp = i % 13 === 12 ? 'declined' : i % 11 === 10 ? 'pending' : 'attending';
    guests.push({
      id: `lg${i + 1}`,
      name: `${surname} ${given}`,
      title: `${side === 'groom' ? '新郎' : '新婦'}の${relation}`,
      side,
      group,
      rsvp,
      allergy: i % 17 === 5 ? ALLERGIES[i % ALLERGIES.length] : '',
      memo: '',
      companions: i % 9 === 4 ? 1 : 0,
      inviteToken: `inv-lg${String(i + 1).padStart(3, '0')}`,
    });
  }

  const tables = Array.from({ length: 15 }, (_, i) => ({
    id: `table-${String.fromCharCode(97 + i)}`,
    name: `${String.fromCharCode(65 + i)}卓`,
    seats: 8,
  }));

  const base: AppState = {
    version: 2,
    info: {
      groomName: '佐藤 健太',
      brideName: '鈴木 美咲',
      date: '2027-04-18',
      venue: '青山ウェディングホール',
      message: '私たちの結婚式にご招待します。皆さまとお会いできることを楽しみにしています。',
    },
    tables,
    tasks: createDefaultTasks('2027-04-18'),
    guests,
    assignments: {},
  };

  return { ...base, assignments: proposeAssignments(base) };
}
