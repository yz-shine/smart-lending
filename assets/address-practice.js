const DATA={
 support:{
  link:["https://","telegram.org.","account-check.example","/login"],owner:2,
  sms:"Служба безопасности: в ваш аккаунт вошли с нового устройства. Подтвердите вход по ссылке и введите код из Telegram.",
  draft:"«В адресе есть слово telegram.org, значит, сайт настоящий. Перейду по ссылке и введу код».",
  worked:"<div class='fb good'><b>Разобранный пример.</b> Адрес <code>https://bank.uz.pay-secure.example/pay</code>. Идём от «/» влево: часть pay-secure.example перед путём, <code>pay-secure.example</code>, и есть основной домен в этом примере. Слова «bank.uz» слева только приставка.</div>",
  hints:["Подсказка: пропусти https:// и посмотри на конец имени сайта перед путём.","Подсказка: слова telegram.org стоят слева. Их может написать кто угодно, владельца они не показывают."]
 },
 self:{
  link:["https://","login.telegram.org.","verify-tg.example","/check"],owner:2,
  sms:"Ваш Telegram будет заблокирован через 10 минут. Пройдите проверку по ссылке и введите код, который придёт в приложение.",
  draft:"«Адрес начинается с login.telegram.org. Похоже на официальный, поэтому введу код для проверки».",
  worked:"",
  hints:["Подсказка: сравни, где в адресе заканчивается название сайта."]
 }
};
export const ACTS=[
 {t:"Перейти по ссылке и ввести код, чтобы не потерять аккаунт",ok:false,
  why:"Код из Telegram даёт вход в аккаунт. Тот, кто его получит, сможет войти вместо тебя. Срочность не подтверждает подлинность сообщения.",
  hint:"Подумай, что получит человек, которому ты отправишь код."},
 {t:"Ответить отправителю и спросить, настоящее ли сообщение",ok:false,
  why:"Отвечать будет тот же отправитель, поэтому его ответ ничего не подтверждает.",
  hint:"Нужен способ проверки, который не зависит от отправителя."},
 {t:"Ничего не нажимать, самостоятельно открыть Telegram и проверить активные сеансы в настройках",ok:true,
  why:"Приложение ты открыла сама, а не по ссылке из сообщения. Поэтому проверка не зависит от отправителя. Сеансы показывают, был ли вход на самом деле."}
];

const steps = [
  ['Пропусти https://. Найди косую черту после имени сайта. С неё начинается путь к странице.', 3],
  ['В этом примере основной домен выделен зелёным. В реальных адресах доменная зона может состоять из нескольких частей, например co.uk.', 2],
  ['Слова слева от основного домена могут напоминать Telegram. По ним нельзя установить, кому принадлежит сайт.', 1],
  ['Не вводи код на странице из сообщения. Открой Telegram самостоятельно и проверь активные сеансы.', 2]
];

export function showAddressPractice(container, {route, lesson, onContinue, onHelp, shuffle}) {
  const scenario = DATA[route === 'support' ? 'support' : 'self'];
  const segments = interactive => scenario.link.map((part, index) => interactive
    ? `<button type="button" class="button secondary" data-part="${index}">${part}</button>`
    : `<code class="button secondary" data-part="${index}">${part}</code>`).join('');
  container.innerHTML = lesson ? `
    <section class="panel"><h3>Как читать адрес по частям</h3>
    <div class="button-row" data-demo>${segments(false)}</div>
    <p class="note" data-caption aria-live="polite"></p>
    <div class="button-row"><button class="button secondary" data-listen>Слушать</button>
    <button class="button secondary" data-stop>Стоп</button>
    <button class="button secondary" data-step>Следующий шаг схемы</button>
    <button class="button primary" data-continue disabled>К тренировке</button></div></section>` : `
    <section class="panel"><h3>Исправь ошибку</h3><p class="note">${scenario.sms}</p>
    <p><strong>Рассуждение для проверки</strong></p><p>${scenario.draft}</p>${scenario.worked}
    <p>Нажми на основной домен в этом примере.</p><div class="button-row" data-task>${segments(true)}</div>
    <p class="note" data-domain-feedback hidden role="status"></p>
    <section data-actions hidden><h3>Что сделаешь после сообщения?</h3>
    <div class="button-row">${shuffle([0,1,2]).map(index => `<button class="button secondary" data-choice="${index}">${ACTS[index].t}</button>`).join('')}</div></section>
    <p class="note" data-action-feedback hidden role="status"></p>
    <div class="button-row"><button class="button secondary" data-help>Спросить Zico</button>
    <button class="button primary" data-continue disabled>К итоговой проверке</button></div></section>`;
  const find = selector => container.querySelector(selector);
  const stop = () => window.speechSynthesis?.cancel();
  find('[data-continue]').onclick = () => {if (lesson) stop(); onContinue();};
  if (lesson) {
    const caption = find('[data-caption]');
    const next = find('[data-step]');
    let index = 0;
    let playback = 0;
    function show(step) {
      index = step;
      caption.textContent = steps[step][0];
      find('[data-demo]').querySelectorAll('[data-part]').forEach(part => {
        part.classList.toggle('primary', Number(part.dataset.part) === steps[step][1]);
        part.classList.toggle('secondary', Number(part.dataset.part) !== steps[step][1]);
      });
      next.disabled = step === steps.length - 1;
      if (next.disabled) find('[data-continue]').disabled = false;
    }
    function cancel() {playback++; stop();}
    function speak(step, token) {
      if (token !== playback || !caption.isConnected) return;
      show(step);
      const speech = new SpeechSynthesisUtterance(steps[step][0]);
      speech.lang = 'ru-RU';
      speech.onend = () => {if (step + 1 < steps.length) speak(step + 1, token);};
      speech.onerror = () => {if (token === playback && caption.isConnected) caption.textContent += ' Озвучка недоступна. Продолжи кнопкой «Следующий шаг схемы».';};
      window.speechSynthesis.speak(speech);
    }
    find('[data-listen]').onclick = () => {
      cancel();
      if (window.speechSynthesis && typeof SpeechSynthesisUtterance === 'function') speak(0, playback);
      else caption.textContent += ' Озвучка недоступна. Шаги можно прочитать.';
    };
    find('[data-stop]').onclick = cancel;
    next.onclick = () => {cancel(); show(Math.min(index + 1, steps.length - 1));};
    show(0);
    return;
  }
  let misses = 0;
  find('[data-help]').onclick = onHelp;
  find('[data-task]').onclick = event => {
    const button = event.target.closest('[data-part]');
    if (!button) return;
    const feedback = find('[data-domain-feedback]');
    const correct = Number(button.dataset.part) === scenario.owner;
    feedback.hidden = false;
    feedback.textContent = correct ? 'Верно. Знакомое слово слева не меняет основной домен.' : scenario.hints[Math.min(misses++, scenario.hints.length - 1)] + ' Попробуй ещё раз.';
    if (correct) {
      button.classList.replace('secondary','primary');
      find('[data-task]').querySelectorAll('button').forEach(option => {option.disabled = true;});
      find('[data-actions]').hidden = false;
    }
  };
  find('[data-actions]').onclick = event => {
    const button = event.target.closest('[data-choice]');
    if (!button) return;
    const action = ACTS[Number(button.dataset.choice)];
    const feedback = find('[data-action-feedback]');
    feedback.hidden = false;
    feedback.textContent = action.ok ? 'Верно. ' + action.why : action.why + ' ' + action.hint + ' Попробуй ещё раз.';
    if (action.ok) {
      button.classList.replace('secondary','primary');
      find('[data-actions]').querySelectorAll('button').forEach(option => {option.disabled = true;});
      find('[data-continue]').disabled = false;
    }
  };
}
