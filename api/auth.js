import { randomUUID } from 'node:crypto';
import { sql, currentUser, session, json, fail, post, limit, digest, cookie } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const user = await currentUser(req);
      return json(res, 200, { ready: Boolean(process.env.DATABASE_URL), user: user ? { id: user.id, username: user.username } : null });
    }
    post(req);
    const { action, name } = req.body || {};
    if (action === 'logout') {
      const token = cookie(req);
      if (token && process.env.DATABASE_URL) await sql('DELETE FROM zico_sessions WHERE token_hash=$1', [digest(token)]);
      res.setHeader('Set-Cookie', `zico_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.VERCEL ? '; Secure' : ''}`);
      return json(res, 200, { ok: true });
    }
    const displayName = typeof name === 'string' ? name.trim() : '';
    if (action !== 'enter' || !/^[\p{L}\p{M}\p{N} ._'’\-]{1,32}$/u.test(displayName) || !/[\p{L}\p{N}]/u.test(displayName)) {
      throw Object.assign(Error('Введи имя или учебное обозначение длиной до 32 символов.'), { status: 400 });
    }
    await limit('auth:' + digest(String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0]), 8, 60);
    const existing = await currentUser(req);
    if (existing?.username === displayName) return json(res, 200, { user: { id: existing.id, username: existing.username } });
    const result = await sql(
      'INSERT INTO zico_users(username,password_hash,display_name) VALUES($1,$2,$3) RETURNING id,display_name AS username',
      [randomUUID().replaceAll('-', ''), '!name-only', displayName]
    );
    const user = result.rows[0];
    await session(res, user, req);
    return json(res, 200, { user });
  } catch (error) {
    fail(res, error);
  }
}
