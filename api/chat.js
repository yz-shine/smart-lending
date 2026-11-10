import {
  routingInstruction,
  resolveReply,
  directReply,
  parseDecision
} from '../lib/zico-policy.js';

import {
  requireUser,
  json,
  fail,
  post,
  limit,
  sql
} from '../lib/db.js';

import { systemInstruction } from '../lib/prompt.js';
import { getModule } from '../assets/content.js';

export default async function handler(req, res) {
  try {
    post(req);

    const user = await requireUser(req);
    const {
      text,
      history = [],
      module: moduleId
    } = req.body || {};

    const invalidHistory =
      !Array.isArray(history) ||
      history.length > 8 ||
      history.some(message =>
        !message ||
        !['user', 'assistant'].includes(message.role) ||
        typeof message.text !== 'string' ||
        message.text.length > 3000
      );

    if (
      typeof text !== 'string' ||
      !text.trim() ||
      text.length > 2000 ||
      invalidHistory
    ) {
      throw Object.assign(
        new Error('Сократи сообщение или начни новый разбор.'),
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const model = process.env.GEMINI_MODEL?.trim();

    if (!apiKey || !model) {
      throw Object.assign(
        new Error(
          'Zico ещё не подключён к Gemini. ' +
          'В настройках Vercel нужно добавить GEMINI_API_KEY ' +
          'и GEMINI_MODEL, затем выполнить Redeploy.'
        ),
        { status: 503 }
      );
    }

    await limit('chat-minute:' + user.id, 5, 60);
    await limit('chat-day:' + user.id, 30, 86400);
    await limit('chat-global', 150, 86400);

    const context = getModule(moduleId);
    const preparedReply = directReply(text);
    if (preparedReply) {
      await sql(
        'INSERT INTO zico_chat_events(user_id, module) VALUES($1, $2)',
        [user.id, context?.id || null]
      );
      json(res, 200, { text: preparedReply });
      return;
    }

    const contents = history.map(message => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.text }]
    }));

    contents.push({
      role: 'user',
      parts: [{ text: text.trim() }]
    });

    const instruction =
      systemInstruction +
      '\n' +
      routingInstruction +
      (context ? '\nСейчас открыта тема ' + context.title : '');

    let response;

    try {
      response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/' +
        encodeURIComponent(model) +
        ':generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: instruction }]
            },
            contents,
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0,
              responseMimeType: 'application/json'
            }
          }),
          signal: AbortSignal.timeout(40000)
        }
      );
    } catch (error) {
      const timedOut =
        error.name === 'TimeoutError' ||
        error.name === 'AbortError';

      throw Object.assign(
        new Error(
          timedOut
            ? 'Gemini не успел ответить. Попробуй немного позже.'
            : 'Не удалось соединиться с Gemini. Попробуй позже.'
        ),
        { status: timedOut ? 504 : 502 }
      );
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      const googleStatus = String(errorData.error?.status || '')
        .replace(/[^A-Z_]/g, '')
        .slice(0, 60);

      const errorCode =
        String(response.status) +
        (googleStatus ? ' (' + googleStatus + ')' : '');

      let explanation =
        'Сообщи этот код владельцу сайта для проверки подключения.';

      if (response.status === 400) {
        explanation =
          'Нужно проверить настройки запроса и доступность API для проекта.';
      } else if (
        response.status === 401 ||
        response.status === 403
      ) {
        explanation =
          'Нужно проверить API-ключ, его ограничения и доступ проекта к Gemini.';
      } else if (response.status === 404) {
        explanation =
          'Нужно проверить название модели в GEMINI_MODEL и её доступность.';
      } else if (response.status === 429) {
        explanation =
          'Достигнут лимит запросов или квота проекта. Попробуй позже.';
      } else if (response.status >= 500) {
        explanation =
          'На стороне Gemini произошла ошибка. Попробуй позже.';
      }

      throw Object.assign(
        new Error('Ошибка Gemini ' + errorCode + '. ' + explanation),
        { status: response.status === 429 ? 429 : 502 }
      );
    }

    const data = await response.json();

    const answer = data.candidates?.[0]?.content?.parts
      ?.filter(part => !part.thought)
      .map(part => part.text || '')
      .join('')
      .trim();

    if (!answer) {
      throw Object.assign(
        new Error(
          'Gemini не вернул текст ответа. ' +
          'Попробуй переформулировать вопрос.'
        ),
        { status: 502 }
      );
    }

    const decision = parseDecision(answer);
    if (!decision) {
      throw Object.assign(
        new Error('Не удалось обработать ответ Gemini. Попробуй отправить вопрос ещё раз.'),
        { status: 502 }
      );
    }

    await sql(
      'INSERT INTO zico_chat_events(user_id, module) VALUES($1, $2)',
      [user.id, context?.id || null]
    );

    const learningModule = ['HINT', 'READY_ANSWER', 'INSUFFICIENT'].includes(decision.category)
      && decision.hint !== 'privacy' && typeof decision.module === 'string'
      ? getModule(decision.module)
      : null;

    let recommendation;
    if (learningModule) {
      const progress = await sql(
        "SELECT 1 FROM zico_results WHERE user_id=$1 AND module=$2 AND payload->>'complete'='true' LIMIT 1",
        [user.id, learningModule.id]
      );
      recommendation = {
        module: learningModule.id,
        completed: progress.rows.length > 0
      };
    }

    json(res, 200, { text: resolveReply(decision), recommendation });
  } catch (error) {
    fail(res, error);
  }
}
