export const questions = [
  {
    title: 'Какие способы позволяют проверить сообщение независимо от отправителя?',
    options: ['Самостоятельно открыть знакомое приложение', 'Позвонить по номеру из сообщения', 'Уточнить сведения через заранее известный контакт', 'Перейти по ссылке из сообщения'],
    key: [0, 2]
  },
  {
    title: 'Какие детали требуют дополнительной проверки?',
    options: ['Просьба передать одноразовый код', 'Угроза заблокировать аккаунт через 15 минут', 'Ты сама открыла привычное приложение', 'Уведомление о действии, которое ты только что начала'],
    key: [0, 1]
  }
];

export const pairs = [
  ['Письмо о проблеме с доставкой', 'Проверить заказ в приложении магазина'],
  ['Неожиданный код для перевода', 'Проверить уведомления в приложении банка'],
  ['Сообщение о новом входе в Telegram', 'Проверить активные сеансы в Telegram']
];

export function gradeFinalCheck(raw) {
  const valid = (values, count) => Array.isArray(values) && new Set(values).size === values.length
    && values.every(value => Number.isInteger(value) && value >= 0 && value < count);
  if (!Array.isArray(raw?.multiple) || raw.multiple.length !== questions.length
    || !questions.every((q, i) => valid(raw.multiple[i], q.options.length) && raw.multiple[i].length)
    || !valid(raw.matching, pairs.length) || raw.matching.length !== pairs.length) {
    throw Object.assign(Error('Ответь на все вопросы итоговой проверки.'), { status: 400 });
  }
  const correct = questions.map((q, i) => raw.multiple[i].length === q.key.length && q.key.every(n => raw.multiple[i].includes(n)));
  correct.push(raw.matching.every((value, i) => value === i));
  return { multiple: raw.multiple, matching: raw.matching, correct, score: correct.filter(Boolean).length, count: correct.length };
}
