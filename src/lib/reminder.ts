import type { Guest, WeddingInfo } from '../types';

export function inviteUrlFor(token: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/rsvp/${token}`;
}

/** 回答締切 = 挙式の30日前 */
export function replyDeadline(info: WeddingInfo): Date | null {
  const d = new Date(`${info.date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - 30);
  return d;
}

export function formatJapaneseDate(d: Date): string {
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${w}）`;
}

export function buildInviteMessage(guest: Guest, info: WeddingInfo, url: string): string {
  return [
    `${guest.name}様`,
    '',
    `${info.groomName}＆${info.brideName}の結婚式のご案内です。`,
    `${info.date.replaceAll('-', '/')} に${info.venue}で挙式を行います。`,
    'ご出欠はこちらのページからご回答ください。',
    url,
    'お会いできるのを楽しみにしています。',
  ].join('\n');
}

export function buildReminderMessage(guest: Guest, info: WeddingInfo, url: string): string {
  const deadline = replyDeadline(info);
  const deadlineText = deadline ? `恐れ入りますが、${formatJapaneseDate(deadline)}までにご回答いただけますと幸いです。` : 'お早めにご回答いただけますと幸いです。';
  return [
    `${guest.name}様`,
    '',
    `先日ご案内した結婚式（${info.date.replaceAll('-', '/')}・${info.venue}）の出欠確認のリマインドです。`,
    deadlineText,
    'こちらからご回答いただけます。',
    url,
    `${info.groomName}＆${info.brideName}`,
  ].join('\n');
}
