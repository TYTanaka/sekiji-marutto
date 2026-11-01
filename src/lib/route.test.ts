import { describe, it, expect } from 'vitest';
import { parseRoute } from './route';

describe('parseRoute', () => {
  it('空・不明なハッシュはトップ', () => {
    expect(parseRoute('')).toEqual({ name: 'top' });
    expect(parseRoute('#/')).toEqual({ name: 'top' });
    expect(parseRoute('#/unknown')).toEqual({ name: 'top' });
  });

  it('各画面をURLで識別できる', () => {
    expect(parseRoute('#/demo')).toEqual({ name: 'demo', large: false });
    expect(parseRoute('#/demo/large')).toEqual({ name: 'demo', large: true });
    expect(parseRoute('#/login')).toEqual({ name: 'login' });
    expect(parseRoute('#/signup')).toEqual({ name: 'signup' });
    expect(parseRoute('#/app')).toEqual({ name: 'app' });
  });

  it('法務ページをURLで識別できる', () => {
    expect(parseRoute('#/privacy')).toEqual({ name: 'privacy' });
    expect(parseRoute('#/terms')).toEqual({ name: 'terms' });
  });

  it('既存のゲスト回答リンクを維持する', () => {
    expect(parseRoute('#/rsvp/inv-1gx8qe64')).toEqual({
      name: 'rsvp',
      token: 'inv-1gx8qe64',
    });
  });
});
