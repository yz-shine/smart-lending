import {questions, pairs} from './final-check.js';
import {getCase, getModule} from './content.js';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'short',
  timeStyle: 'medium'
});

function formatDate(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? dateFormat.format(date) : 'Дата не указана';
}

function wrapText(context, value, width) {
  const lines = [];
  for (const paragraph of String(value).split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const joined = line ? line + ' ' + word : word;
      if (context.measureText(joined).width <= width) {
        line = joined;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const character of word) {
        if (context.measureText(line + character).width > width) {
          lines.push(line);
          line = '';
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

function prepareReport(result, username, downloadedAt, context) {
  const attempts = result.answers || [];
  const cases = result.caseIds?.length ? result.caseIds : [...new Set(attempts.map(answer => answer.caseId))];
  const line = (text, size = 23, color = '#28483a', weight = 400) => {
    const font = weight + ' ' + size + 'px system-ui, sans-serif';
    context.font = font;
    return {font, color, lines: wrapText(context, text, 920), spacing: Math.ceil(size * 1.35)};
  };
  const retries = cases.reduce((sum, id) => sum + Math.max(0, attempts.filter(a => a.caseId === id).length - 1), 0);
  const module = getModule(result.module)?.title || 'Учебный модуль';
  const header = [
    line('SMART ОБРАЗОВАНИЕ  /  РЕЗУЛЬТАТЫ ПРОХОЖДЕНИЯ', 19, '#9de6bd', 700),
    line('Распознавание фишинговых сообщений', 39, '#ffffff', 700),
    line(module + '  ·  ' + username, 27, '#d0f3df', 600),
    line('Пройдено ' + formatDate(result.finishedAt), 22, '#ffffff'),
    line('Скачано ' + formatDate(downloadedAt), 22, '#ffffff')
  ];
  const summary = [
    ...(result.finalCheck ? [line("Итоговая проверка  " + result.finalCheck.score + " из " + result.finalCheck.count)] : []),
    line('Первые верные ответы  ' + (result.firstScore ?? '—') + ' из ' + (result.questionCount || cases.length), 28, '#155337', 700),
    line('Повторные попытки  ' + retries + '     ·     Подсказки Zico  ' + (result.chatCount || 0)),
    line('Маршрут  ' + (result.route === 'support' ? 'с поддержкой' : 'самостоятельный'))
  ];
  const cards = cases.map((id, index) => {
    const item = getCase(id);
    const answers = attempts.filter(answer => answer.caseId === id);
    const first = answers[0];
    const last = answers.at(-1);
    const final = cases.length >= 6 ? index >= cases.length - 2 : index === cases.length - 1;
    const option = key => item?.options.find(([value]) => value === key)?.[1] || key || '—';
    const verdict = answer => answer ? (answer.correct ? 'Верно' : 'Требуется пересмотр') : 'Ответ отсутствует';
    const verdictColor = answer => answer?.correct ? '#12643c' : '#8a4224';
    const rows = [
      line(String(index + 1).padStart(2, '0') + '  /  ' + (final ? 'ИТОГОВАЯ СИТУАЦИЯ' : index === 0 ? 'ВХОДНАЯ СИТУАЦИЯ' : 'ТРЕНИРОВКА'), 18, '#487460', 700),
      line(item?.question || 'Учебная ситуация', 26, '#112d21', 700),
      line('Первый ответ  ·  ' + verdict(first), 22, verdictColor(first), 700),
      line('Выбрано  ' + option(first?.choice)),
      line('Ожидаемое действие  ' + option(item?.correct), 23, '#155337', 600)
    ];
    if (first?.reason) rows.push(line('Объяснение  ' + first.reason, 21));
    if (answers.length > 1) {
      rows.push(line('Повторных попыток  ' + (answers.length - 1), 21, '#487460', 600));
      rows.push(line('Последний ответ  ·  ' + verdict(last), 22, verdictColor(last), 700));
      rows.push(line('Выбрано  ' + option(last.choice)));
      if (last.reason) rows.push(line('Объяснение  ' + last.reason, 21));
    }
    return {rows, fill: final ? '#eaf7f0' : '#ffffff', border: last?.correct ? '#329367' : '#c57e53'};
  });
  return [
    {rows: header, fill: '#103729', border: '#52b984'},
    {rows: summary, fill: '#dbefe2', border: '#52b984'},
    ...cards,
    ...(result.finalCheck ? [{
      fill: '#eaf7f0', border: '#329367',
      rows: [
        line('ИТОГОВЫЕ ВОПРОСЫ', 23, '#155337', 700),
        ...questions.flatMap((question, i) => [
          line(question.title, 22, '#112d21', 700),
          line('Выбрано: ' + result.finalCheck.multiple[i].map(n => question.options[n]).join('; ')),
          line(result.finalCheck.correct[i] ? 'Верно' : 'Требуется пересмотр')
        ]),
        line('Сопоставление', 22, '#112d21', 700),
        ...pairs.map(([situation], i) => line(situation + ' → ' + pairs[result.finalCheck.matching[i]][1])),
        line(result.finalCheck.correct[questions.length] ? 'Верно' : 'Требуется пересмотр')
      ]
    }] : []),
    {rows: [line('Письменные объяснения сохранены без автоматической оценки.', 19)], fill: '#e6efe9', border: '#c1d7cb'}
  ];
}

export async function saveResultImage(result, username) {
  const downloadedAt = new Date();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw Error('Canvas is unavailable');
  const blocks = prepareReport(result, username, downloadedAt, context);
  const blockHeight = block => 48 + block.rows.reduce((total, row) => total + row.lines.length * row.spacing + 8, 0);
  canvas.width = 1080;
  canvas.height = 64 + blocks.reduce((total, block) => total + blockHeight(block) + 18, 0);
  const background = context.createLinearGradient(0, 0, 1080, canvas.height);
  background.addColorStop(0, '#dcefe3');
  background.addColorStop(1, '#f5f5ef');
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = 'top';

  let top = 32;
  for (const block of blocks) {
    const height = blockHeight(block);
    context.fillStyle = block.fill;
    context.beginPath();
    context.roundRect(40, top, 1000, height, 24);
    context.fill();
    context.fillStyle = block.border;
    context.fillRect(64, top + 26, 4, height - 52);

    let y = top + 24;
    for (const row of block.rows) {
      context.font = row.font;
      context.fillStyle = row.color;
      for (const text of row.lines) {
        context.fillText(text, 80, y);
        y += row.spacing;
      }
      y += 8;
    }
    top += height + 18;
  }

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw Error('PNG export failed');
  const url = URL.createObjectURL(blob);
  const stamp = new Intl.DateTimeFormat('sv-SE', {dateStyle:'short', timeStyle:'medium'})
    .format(downloadedAt).replace(/[^\d-]+/g, '-');
  const link = document.createElement('a');
  link.download = 'Zico-' + String(result.module).replace(/[^a-z0-9-]/gi, '') + '-' + stamp + '.png';
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
