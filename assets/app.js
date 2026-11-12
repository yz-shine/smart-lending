import {questions, pairs, gradeFinalCheck} from './final-check.js';
import {modules,shuffle,getModule,getCase} from './content.js';
import {saveResultImage} from './result-image.js';
import {lessons,practiceLength,selectPracticeCases,gradeChoice,supportExample} from './course.js';
const $=s=>document.querySelector(s), main=$('#main');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
let user=null,demo=false,authMode='login',run=null,chat=[],busy=false,cloudReady=false,pendingModule=null;
let currentModuleTab='theory',currentModuleId=null;
let localResults=[],savedChatCount=0;
const uuid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const forwardIcon='<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const btn=(text,action,kind='primary')=>{const forward=/^(start:|route:|next$|retry$|material-next$|login$|tab:.*:(practice|examples)$)/.test(action);return `<button type="button" class="button ${kind}${forward?' action-button':''}" data-action="${action}"><span>${text}</span>${forward?forwardIcon:''}</button>`};
const head=(label,title,desc)=>`<section class="section-head"><div><span class="eyebrow">${label}</span><h2>${title}</h2><p>${desc}</p></div></section>`;
const moduleTitle=id=>getModule(id)?.title||'Доставка · исходный модуль';
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),3500)}
async function api(path,body){const r=await fetch('/api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});let data;try{data=await r.json()}catch{throw Error('Сервер пока не подключён. Используй режим просмотра.')}if(!r.ok)throw Error(data.error||'Не удалось выполнить запрос.');return data}
function resultKey(){return 'zico.results.'+(demo?'demo':user?.id||'guest')}
function chatKey() {
  return user && !demo ? 'zico.chat.' + user.id : null;
}

function loadLocal() {
  localResults = read(resultKey(), []);
  const key = chatKey();
  const saved = key ? read(key, []) : [];
  chat = Array.isArray(saved) ? saved.slice(-60).filter(message =>
    message && ['user', 'assistant'].includes(message.role) &&
    typeof message.text === 'string'
  ) : [];
  drawChat();
}

function saveChat() {
  const key = chatKey();
  if (!key) return;
  const messages = chat.filter(message => message.role !== 'notice').slice(-60);
  if (!write(key, messages)) toast('Не удалось сохранить переписку в этом браузере.');
}
function navigate(page){if(run&&!['play'].includes(page)&&!confirm('Выйти из текущего разбора? Незавершённые ответы этой попытки не сохранятся.'))return;run=null;location.hash=page;if(location.hash==='#'+page)render()}
let renderFrame = 0;
let renderedPage;
let stopHero = () => {};

function render() {
  cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(renderNow);
}

function renderNow() {
  const page = location.hash.slice(1) || 'home';
  const changedPage = renderedPage !== page;
  if (changedPage && $('#zico-open').getAttribute('aria-expanded') === 'true') closeChat(false);
  renderedPage = page;
  stopHero();
  hideTermTip();
  main.getAnimations().forEach(animation => animation.cancel());
  main.dataset.page = page.startsWith('module/') ? 'module' : page;
  renderAccount();
  updateTopNav(page);
  closeMenus();
  if (page === 'login' || (!user && ['progress','original','play'].includes(page))) login();
  else if (run && page === 'play') play();
  else if (page.startsWith('module/')) modulePage(page.split('/')[1], page.split('/')[2] || 'theory');
  else ({
    home, modules:catalog, progress, about, original, glossary,
    examples:() => sectionHub('Примеры','Разобранные сообщения','example'),
    'practice-hub':() => sectionHub('Практика','Выбери область для тренировки','module-practice'),
    'test-hub':() => sectionHub('Тесты','Итоговая проверка после практики','module-test')
  }[page] || home)();

  if (page === 'home') startHero();
  if (page === 'progress' && changedPage && user && !demo) syncResults();
  window.scrollTo({top:0, behavior:'instant'});
  main.focus({preventScroll:true});
  if (changedPage && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    main.animate([{opacity:.76}, {opacity:1}], {duration:170, easing:'ease-out'});
  }
}
function enterCourse(){loadLocal();if(pendingModule){const id=pendingModule;pendingModule=null;start(id)}else{location.hash='modules';render()}}
function login() {
  main.innerHTML = head('Учебный курс', 'Вход по имени', 'Имя будет указано в итоговом отчёте.') + `<section class="panel login-card"><form id="auth-form">
    <label for="participant-name">Имя или учебное обозначение</label>
    <input class="text-input" id="participant-name" name="name" required maxlength="32" autocomplete="off" placeholder="Например, Участница А">
    <div id="auth-error" class="error-text" role="alert"></div>
    <button class="button primary" type="submit">Войти</button>
  </form></section>`;
  $('#auth-form').onsubmit = async event => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    try {
      const response = await api('auth', {action:'enter', name:$('#participant-name').value.trim()});
      user = response.user;
      demo = false;
      enterCourse();
    } catch (error) {
      $('#auth-error').textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
const heroExamples = [
  ['@','Служба доставки','Посылка не доставлена','Подтвердите адрес и данные карты. Иначе заказ будет отменён.'],
  ['↗','Сообщение в Telegram','Вход с нового устройства','Для отмены входа просят отправить код из уведомления.'],
  ['◇','Уведомление о платеже','Неизвестная операция','«Сотрудник банка» просит назвать код, чтобы остановить перевод.'],
  ['▤','Учебная почта','Доступ к списку группы','Для просмотра списка просят ввести пароль от учебного аккаунта.']
].slice(0, modules.length === 3 ? 3 : 4);

function startHero() {
  const stage = $('.hero-message-stage');
  const cards = [...stage.querySelectorAll('.mail-card')];
  const dots = [...$('.hero-message-controls').querySelectorAll('[aria-pressed]')];
  let active = 0;
  let timer;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => $('.course-art')?.matches(':hover, :focus-within');
  function show(index) {
    const previous = cards[active];
    active = index;
    cards.forEach(card => card.getAnimations().filter(a => a.id === 'hero-slide').forEach(a => a.cancel()));
    if (previous !== cards[index] && !reducedMotion.matches) {
      const duration = {duration:660, easing:'cubic-bezier(.25,.7,.3,1)', id:'hero-slide'};
      previous.animate([
        {transform:'translateX(0) rotate(-2deg)', opacity:1, visibility:'visible'},
        {transform:'translateX(-48px) rotate(-4deg)', opacity:0, visibility:'visible'}
      ], duration);
      cards[index].animate([
        {transform:'translateX(48px) rotate(1deg)', opacity:0},
        {transform:'translateX(0) rotate(-2deg)', opacity:1}
      ], duration);
    }
    cards.forEach((card, i) => {
      card.classList.toggle('is-current', i === index);
      card.setAttribute('aria-hidden', String(i !== index));
      dots[i].setAttribute('aria-pressed', String(i === index));
    });
  }
  function restart() {
    clearInterval(timer);
    if (!reducedMotion.matches) timer = setInterval(() => {
      if (!document.hidden && !paused()) show((active + 1) % cards.length);
    }, 6200);
  }
  dots.forEach((button, index) => button.onclick = () => { show(index); restart(); });
  $('.hero-next').onclick = () => { show((active + 1) % cards.length); restart(); };
  show(0);
  restart();
  reducedMotion.addEventListener('change', restart);
  stopHero = () => {
    clearInterval(timer);
    reducedMotion.removeEventListener('change', restart);
  };
}

function home(){main.innerHTML=`<section class="hero course-hero"><div><span class="eyebrow">Короткий курс цифровой безопасности</span><h1>Распознавание<br><em>фишинговых сообщений</em></h1><p class="hero-motto">Прежде чем <span>доверять, <em>проверь.</em></span></p><p class="lead">Сообщение может выглядеть знакомым и убедительным. На этом курсе ты научишься замечать опасные просьбы и проверять их через независимый источник.</p><div class="meta"><span class="chip">${modules.length} модул${modules.length === 3 ? 'я' : 'ей'}</span><span class="chip">Примеры и практика</span><span class="chip">В своём темпе</span></div><div class="button-row">${btn('Посмотреть карту курса','course-map')}${btn('Перейти к модулям','modules','secondary')}</div></div><div class="mail-art course-art"><span class="art-label">Входящее сообщение</span><div class="hero-message-stage">${heroExamples.map(([icon, source, title, body], i) => `<article class="mail-card${i===0?' is-current':''}" aria-hidden="${i!==0}"><div class="mail-head"><span class="avatar" aria-hidden="true">${icon}</span><div>${source}<small>Учебный пример</small></div></div><h2>«${title}»</h2><p>${body}</p><div class="message-footer"><span class="message-dot"></span>Что в этой просьбе стоит проверить?</div></article>`).join('')}</div><div class="hero-message-controls" role="group" aria-label="Примеры сообщений">${heroExamples.map(([, source], i) => `<button type="button" aria-label="${source}" aria-pressed="${i===0}"></button>`).join('')}<button type="button" class="hero-next" aria-label="Следующее сообщение">→</button></div><div class="art-question"><b>Что проверить первым?</b><span>Отправителя, требование или ссылку?</span></div></div></section>
<section class="course-section" id="intro">${head('Введение','О чём этот курс','Фишинговое сообщение пытается убедить человека раскрыть данные, предоставить доступ или выполнить опасное действие.')}<div class="intro-copy"><p>Такие сообщения встречаются в мессенджерах, электронной почте, SMS и чатах объявлений. Они могут ссылаться на настоящий заказ, приходить со знакомого аккаунта или обещать помощь.</p><p>Курс подойдёт тем, кто хочет увереннее разбирать повседневные сообщения. Ты будешь принимать решения в роли владельца аккаунта, покупателя, клиента банка и участника учебной группы.</p></div></section>
<section class="course-section" id="goals">${head('Цели','Что ты сможешь после курса','Результат проверяется на новых учебных ситуациях, а не по запоминанию названий.')}<div class="goals-grid">${['Находить подозрительную просьбу, даже если имя отправителя знакомо.','Различать опасное требование и обычное уведомление.','Выбирать способ проверки, который не зависит от сообщения.','Объяснять решение конкретными деталями, а не только общим впечатлением.'].map((t,i)=>`<article class="goal-item"><span>0${i+1}</span><p>${t}</p></article>`).join('')}</div></section>
<section class="course-section" id="course-map">${head('Карта курса','Из чего состоит обучение','Можно сначала познакомиться с материалами, затем войти и перейти к своим заданиям.')}<div class="course-map-grid">${[['Введение','О чём курс и зачем он тебе','anchor:intro','01'],['Цели','Что получится делать после курса','anchor:goals','02'],['Карта курса','Порядок работы и навигация','about','03'],['Модули','Теория небольшими разделами','modules','04'],['Примеры','Разбор сообщений из разных ситуаций','examples','05'],['Практика','Твоя роль, действие и объяснение','practice-hub','06'],['Тесты','Проверка с обратной связью','test-hub','07'],['Глоссарий','Понятные объяснения терминов','glossary','08']].map(([title,desc,action,n])=>`<button class="map-card" data-action="${action}"><div class="map-card-title"><span class="map-number">${n}</span><h3>${title}</h3></div><p>${desc}</p></button>`).join('')}</div></section>
<section class="course-section" id="course-modules">${head('Темы курса',modules.length === 3 ? 'Три области, одно умение' : 'Пять областей, одно умение','В каждом модуле есть короткая теория, разобранный пример, практика и итоговая проверка.')}${cards()}</section><section class="course-cta"><div><span class="eyebrow">Готова попробовать?</span><h2>Теперь твоё решение.</h2><p>Войди, чтобы перейти к практике и сохранять результаты. Материалы курса доступны для знакомства без регистрации.</p></div><div class="button-row">${btn(user?'Продолжить обучение':'Войти и начать',user?'modules':'login')}${!user?btn('Сначала посмотреть','modules','secondary'):''}</div></section>`}
const moduleIcons=[
'<path d="m3 10 18-7-7 18-3-7-8-4Z"/><path d="m11 14 5-6"/>',
'<path d="m3 7 9-4 9 4v11l-9 4-9-4V7Z"/><path d="m3 7 9 4 9-4M12 11v11M7 5l10 4"/>',
'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
'<path d="M12 5c-4-3-7-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-5-2-9 1ZM12 5v15"/>',
'<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v3h4v-3"/>'
].map(paths=>`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`);
function cards(){return `<div class="catalog">${modules.map((m,i)=>`<article class="panel module-card"><div class="module-card-heading"><div class="module-icon" aria-hidden="true">${moduleIcons[i]}</div><div><span class="eyebrow">${m.level}</span><h3>${m.title}</h3></div></div><p class="muted">${m.summary}</p><div class="module-card-bottom"><span class="small">${practiceLength} ситуаций<br>15-20 минут</span>${btn('Открыть модуль','module:'+m.id,'secondary')}</div></article>`).join('')}</div>`}
function catalog(){main.innerHTML=head('Учебные маршруты','Выбери свою ситуацию','Первая задача помогает выбрать объём поддержки. Итоговая задача общая для обоих маршрутов.')+cards()+`<section class="original-banner"><div><b>Дополнительная практика о доставке</b><p>Сохранён исходный разбор доставки, маршруты и выгрузка SVG.</p></div>${btn('Открыть исходный модуль','original','secondary')}</section>`}
const lastOptionOrders = new Map();
function shuffleOptions(caseId) {
  const order = shuffle(getCase(caseId).options);
  const previous = lastOptionOrders.get(caseId);
  if (order.length > 1 && previous && order.every(([key], i) => key === previous[i])) {
    order.push(order.shift());
  }
  lastOptionOrders.set(caseId, order.map(([key]) => key));
  return order;
}
function start(id){if(!user){pendingModule=id;navigate('login');return}const m=getModule(id);run={id:uuid(),module:id,step:0,phase:'question',route:null,answers:[],caseIds:selectPracticeCases(m,shuffle),order:[],startedAt:new Date().toISOString(),helpCount:0};run.order=shuffleOptions(run.caseIds[0]);location.hash='play';render();if(!read('zico.practiceIntro',false)){write('zico.practiceIntro',true);openChat(false)}}
function messageMarkup(c,m){const mark=text=>{let html=esc(text);for(const [id,label] of c.evidence||[])for(const part of label.split(' · ')){const pattern=part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');html=html.replace(new RegExp(pattern,'gi'),match=>`<button type="button" class="frag" data-evidence="${id}" aria-pressed="false">${match}</button>`)}return html};return `<article class="case-message ${({telegram:'telegram-message',delivery:'delivery-message',bank:'bank-message',study:'study-message',market:'market-message'})[m.id]||''}"><div class="message-app-label">${({telegram:'Telegram',delivery:'Входящее письмо',bank:'Уведомление банка',study:'Учебная почта',market:'Сообщение по объявлению'})[m.id]||'Учебное сообщение'}</div><div class="role-label">${mark(c.from)}</div><p class="scenario-message">${mark(c.message)}</p>${c.messages?`<div class="compare message-comparison">${c.messages.map(msg=>`<article class="mail"><b>${esc(msg.label)}</b><p>${esc(msg.text)}</p></article>`).join('')}</div>`:''}</article>${c.context?`<p class="case-context"><strong>Контекст ситуации</strong> ${mark(c.context)}</p>`:''}${c.evidence?'<p class="note">Нажимай на выделенные фрагменты, которые повлияли на решение. Повторное нажатие снимает отметку. Отмечать всё подряд не нужно.</p>':''}`}
function play(){if(run.phase==='final-check'){showFinalCheck();return;}const m=getModule(run.module),c=getCase(run.caseIds[run.step]),total=run.caseIds.length;const stage=run.step===0?'Входная ситуация':run.step>=total-2?'Итоговая проверка':'Тренировка';main.innerHTML=head(`${stage} · ${run.step+1} из ${total}`,m.title,`Твоя роль - ${m.role.toLowerCase()}. Прочитай сообщение, выбери действие и объясни решение.`)+`<div class="case-progress" aria-label="Ситуация ${run.step+1} из ${total}">${run.caseIds.map((_,i)=>`<span class="${i<=run.step?'done':''}"></span>`).join('')}</div>`;
if(run.phase==='route'){main.innerHTML+=`<div class="note">По первому ответу ${run.answers[0].correct?'рекомендуется самостоятельный маршрут.':'рекомендуется маршрут с поддержкой.'} Можно выбрать другой путь. Письменное объяснение сохраняется для преподавателя.</div><div class="routes"><section class="route ${!run.answers[0].correct?'recommended':''}"><span class="eyebrow">Больше пояснений</span><h3>С поддержкой</h3><p>Сначала пример с объяснением. Затем три более простые ситуации с подсказками и две общие итоговые задачи.</p>${btn('Выбрать поддержку','route:support')}</section><section class="route ${run.answers[0].correct?'recommended':''}"><span class="eyebrow">Сначала своё решение</span><h3>Самостоятельно</h3><p>Три ситуации, где знакомые детали могут сбить с толку. Сначала попробуй решить их сама, затем выполни две общие итоговые задачи.</p>${btn('Проверить себя','route:independent')}</section></div>`;return}
if(run.phase==='material'){main.innerHTML+=`<section class="panel"><h3>Перед тренировкой</h3><div class="note"><strong>Пример с объяснением</strong><p>${esc(supportExample(m.id))}</p></div>${m.tips.map(t=>`<p>${esc(t)}</p>`).join('')}${btn('Перейти к тренировке','material-next')}</section>`;return}
const attempts=run.answers.filter(x=>x.caseId===c.id),last=attempts.at(-1),reviewed=run.phase==='feedback';const canRetry=run.step<total-2&&!last?.correct&&attempts.length<3;
main.innerHTML+=`<div class="grid practice-grid"><section>${messageMarkup(c,m)}${run.route==='support'&&run.step>0&&run.step<total-2?`<details class="panel compact-hint"><summary>Подсказка к этой ситуации</summary><p>${esc(c.hint)}</p>${m.tips.map(t=>`<p class="small">${esc(t)}</p>`).join('')}</details>`:''}</section><section class="panel"><form id="case-form"><fieldset ${reviewed?'disabled':''}><legend>${esc(c.question)}</legend>${run.order.map(([id,text])=>`<label class="option"><input required type="radio" name="choice" value="${id}" ${last?.choice===id?'checked':''}><span>${esc(text)}</span></label>`).join('')}</fieldset><label class="label" for="reason">Объясни свой выбор</label><textarea id="reason" name="reason" required minlength="10" maxlength="1200" ${reviewed?'disabled':''} placeholder="Назови конкретные признаки и способ независимой проверки.">${esc(last?.reason||'')}</textarea><p class="small muted">Первый ответ сохраняется отдельно от повторных попыток. Объяснение проверяет преподаватель.</p>${reviewed?'':`<div class="case-actions">${btn('Спросить Zico','zico','secondary')}<button class="button action-button" type="submit">Сохранить ответ ${forwardIcon}</button></div>`}</form>${reviewed?`<div class="feedback ${last.correct?'':'error'}"><h3>${last.correct?(c.evidence?'Действие и отметки проверены':'Действие выбрано верно'):'Проверь своё решение'}</h3><p>${esc(last.correct?c.explanation:c.hint)}</p>${!last.correct&&!canRetry?`<p>${esc(c.explanation)}</p>`:''}<div class="button-row">${canRetry?btn('Повторить попытку','retry'):''}${btn(run.step===0?'Выбрать маршрут':run.step===total-1?'К итоговым вопросам':run.step===total-3?'К итоговой проверке':'Следующая ситуация','next')}</div></div>`:''}${reviewed&&!last.correct?`<div class="note"><p>Трудно определить важную деталь? Попроси Zico помочь.</p>${btn('Спросить Zico','zico','secondary')}</div>`:''}</section></div>`;
addTermTips(main, '.case-message p, .case-context');
const flagButtons=[...document.querySelectorAll('[data-evidence]')];const selected=new Set(last?.evidence||[]);function syncFlags(){for(const b of flagButtons){b.setAttribute('aria-pressed',String(selected.has(b.dataset.evidence)));b.disabled=reviewed}}syncFlags();for(const b of flagButtons)b.onclick=()=>{const id=b.dataset.evidence;selected.has(id)?selected.delete(id):selected.add(id);syncFlags()};
if(!reviewed)$('#case-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),reason=f.get('reason').trim(),evidence=[...selected];if(reason.length<10){toast('Добавь короткое объяснение своими словами.');return}if(c.evidence&&!evidence.length){toast('Отметь в сообщении фрагмент, который повлиял на решение.');return}run.answers.push({caseId:c.id,choice:f.get('choice'),reason,evidence,correct:gradeChoice(c,f.get('choice'),evidence),attempt:attempts.length+1,at:new Date().toISOString()});run.phase='feedback';
const scrollTop = window.scrollY;
const hintOpen = $('.compact-hint')?.open;
play();
const hint = $('.compact-hint');
if (hint) hint.open = Boolean(hintOpen);
const feedback = $('.feedback');
feedback.setAttribute('tabindex', '-1');
feedback.focus({preventScroll:true});
window.scrollTo({top:scrollTop, behavior:'instant'});}}
async function finish(){const result={...run,complete:true,finishedAt:new Date().toISOString(),questionCount:run.caseIds.length+run.finalCheck.count,firstScore:run.caseIds.filter(id=>run.answers.find(a=>a.caseId===id)?.correct).length+run.finalCheck.score,finalCorrect:run.answers.filter(a=>a.caseId===run.caseIds.at(-1)).at(-1)?.correct,chatCount:run.helpCount};delete result.order;localResults.unshift(result);write(resultKey(),localResults);run=null;if(!demo){try{const saved=await api('results',{result});Object.assign(result,saved.result,{synced:true});write(resultKey(),localResults)}catch{toast('Результат сохранён в браузере. Отправка на сервер пока не удалась.')}}location.hash='progress';render()}

function progress(){const completed=localResults.filter(x=>x.complete && getModule(x.module));main.innerHTML=head('Личный кабинет','Мои результаты','Здесь разделены первые ответы, повторные попытки и обращения за помощью. Письменные объяснения требуют проверки преподавателем.')+`<div class="stats-grid"><section class="panel"><strong>${new Set(completed.map(x=>x.module)).size}</strong><span class="muted">модулей пройдено</span></section><section class="panel"><strong>${completed.length}</strong><span class="muted">завершённых прохождений</span></section><section class="panel"><strong>${completed.reduce((n,r)=>n+(r.chatCount||0),0)}</strong><span class="muted">обращений к помощнику в прохождениях</span></section></div><section class="panel table-scroll" style="margin-top:20px"><table><thead><tr><th>Модуль</th><th>Первые ответы</th><th>Повторные попытки</th><th>Сохранение</th><th>Подробности</th><th>Скачать</th></tr></thead><tbody>${completed.map((r,i)=>`<tr><td>${esc(moduleTitle(r.module))}<br><small>${new Date(r.finishedAt).toLocaleString('ru-RU')}</small></td><td>${r.firstScore??'—'} / ${r.questionCount||r.caseIds?.length||3}</td><td>${Math.max(0,(r.answers?.length||0)-(r.questionCount||r.caseIds?.length||3))}</td><td>${r.synced?'Сервер и браузер':'Этот браузер'}</td><td><button class="link-button" data-action="detail:${i}">Ответы</button></td><td><button class="link-button" data-action="png:${i}" aria-label="Скачать PNG: ${esc(moduleTitle(r.module))}">PNG</button></td></tr>`).join('')||'<tr><td colspan="6">Пока нет завершённых разборов.</td></tr>'}</tbody></table></section><div id="result-detail"></div>`}
async function syncResults() {
  const account = user;
  const key = resultKey();
  for (const result of localResults.filter(item => !item.synced)) {
    try {
      const saved = await api('results', {result});
      if (user !== account) return;
      Object.assign(result, saved.result, {synced:true});
      write(key, localResults);
    } catch {
      if (user !== account) return;
    }
  }
  try {
    const remote = await api('results');
    if (user !== account) return;
    const merged = new Map(localResults.map(result => [result.id, result]));
    for (const result of remote.results) merged.set(result.id, {...result, synced:true});
    localResults = [...merged.values()].sort((a,b) => b.finishedAt.localeCompare(a.finishedAt));
    write(key, localResults);
    if (location.hash === '#progress' && !$('#result-detail')?.children.length) progress();
  } catch {
    if (user === account && location.hash === '#progress') toast('Показаны результаты, сохранённые в этом браузере.');
  }
}

function detail(i){const r=localResults.filter(x=>x.complete && getModule(x.module))[i];if(!r)return;$('#result-detail').innerHTML=`<section class="panel" style="margin-top:20px"><h3>${esc(moduleTitle(r.module))}</h3><p class="small muted">Маршрут - ${r.route==='support'?'с поддержкой':'самостоятельный'}</p>${(r.answers||[]).map(a=>`<div class="answer-review"><b>${esc(getCase(a.caseId)?.question||'Исходный модуль')}</b><p>${esc(getCase(a.caseId)?.options.find(o=>o[0]===a.choice)?.[1]||a.choice)}</p><p>${esc(a.reason)}</p>${a.evidence?.length?`<p class="small muted">Отмечены фрагменты: ${a.evidence.map(id=>esc(getCase(a.caseId)?.evidence?.find(e=>e[0]===id)?.[1]||id)).join('; ')}</p>`:''}<small>Попытка ${a.attempt} · ${a.correct?'действие верное':'действие требует пересмотра'}</small></div>`).join('')}<p class="small muted">Объяснения автоматически не оценивались.</p></section>`;$('#result-detail').scrollIntoView({behavior:'smooth'})}
function about() {
  main.innerHTML = head('Помощь','Как проходить курс','Открой модуль и выполни задания по порядку.') + `<div class="help-grid">
    <section class="panel"><h3>Практика и тест</h3><p>Ответь на входной вопрос и выбери маршрут. После практики выполни итоговую проверку. Первые ответы учитываются в общем балле.</p></section>
    <section class="panel"><h3>ИИ-помощник Zico</h3><p>Нажми на значок Z внизу экрана или на кнопку рядом с обратной связью. Опиши, какая деталь вызвала сомнение.</p><p class="small muted">Используй учебные примеры без реальных кодов и личных данных.</p>${btn('Открыть чат Zico','zico','secondary')}</section>
    <section class="panel"><h3>Результат и отчёт</h3><p>Открой «Мои результаты» в профиле. Кнопка PNG рядом с прохождением скачивает отчёт с твоим именем и баллом.</p></section>
    <section class="panel"><h3>История чата</h3><p>Открой чат в том же браузере, чтобы увидеть предыдущие сообщения. Кнопка «Очистить чат» удаляет историю.</p></section>
  </div>`;
}
function original(){main.innerHTML=head('Дополнительный тренажёр','Доставка · разбор писем','Сохранены материалы, два маршрута, подсказки и скачивание SVG. Этот модуль учитывается отдельно от новых ролевых разборов.')+`<iframe title="Исходный учебный модуль о доставке" class="original-frame" src="modules/Фишинговые сообщения СМАРТ.html"></iframe>`}
function sectionHub(label,title,target){main.innerHTML=head(label,title,'Выбери тему, чтобы перейти к нужной части модуля.')+`<div class="catalog">${modules.map(m=>`<article class="panel module-card"><span class="eyebrow">${m.level}</span><h3>${m.title}</h3><p class="muted">${m.summary}</p>${btn('Открыть раздел','section:'+m.id+':'+target)}</article>`).join('')}</div>`}
function modulePage(id,tab='theory'){const m=getModule(id),lesson=lessons[id];if(!m||!lesson){catalog();return}const tabs=[['theory','Теория'],['examples','Примеры'],['practice','Практика'],['test','Тест']];if(!tabs.some(t=>t[0]===tab))tab='theory';currentModuleId=id;currentModuleTab=tab;main.innerHTML=head('Учебный модуль',m.title,m.summary)+`<div class="module-subnav module-tabs" role="tablist" aria-label="Разделы модуля">${tabs.map(([key,label])=>`<button role="tab" id="tab-${key}" aria-selected="${key===tab}" aria-controls="module-panel" tabindex="${key===tab?'0':'-1'}" data-action="tab:${id}:${key}">${label}</button>`).join('')}</div><section id="module-panel" role="tabpanel" aria-labelledby="tab-${tab}" tabindex="-1"></section>`;
const moduleHead=main.querySelector('.section-head');moduleHead.classList.add('module-heading');moduleHead.append(main.querySelector('.module-tabs'));
const panel=$('#module-panel');if(tab==='theory'){panel.innerHTML=`<div class="module-tab-heading"><div><span class="eyebrow">${lesson.eyebrow}</span><h3>Разберёмся по шагам</h3></div>${btn('К примерам','tab:'+id+':examples','secondary')}</div><div class="theory-sections">${lesson.sections.map(([title,...paras],i)=>`<article class="panel theory-card"><div class="theory-number">0${i+1}</div><div><h3>${esc(title)}</h3>${paras.map(p=>`<p>${esc(p)}</p>`).join('')}</div></article>`).join('')}</div>`}
else if(tab==='examples'){panel.innerHTML=`<div class="module-tab-heading"><div><span class="eyebrow">Примеры с объяснениями</span><h3>Сравни просьбы и способы проверки</h3></div>${btn('К практике','tab:'+id+':practice','secondary')}</div><div class="example-list">${lesson.exampleIds.map((caseId,i)=>{const c=getCase(caseId);return `<article class="example-card"><span class="eyebrow">Пример ${i+1}</span><div class="grid"><section>${messageMarkup({...c,evidence:undefined},m)}</section><section class="panel"><h3>Разбор</h3><p>${esc(c.explanation)}</p><p class="small muted">${esc(c.hint)}</p></section></div></article>`}).join('')}</div>`}
else if(tab==='practice'){panel.innerHTML=`<section class="panel practice-intro"><div class="module-tab-heading"><div><span class="eyebrow">Практическое прохождение</span><h3>Попробуй в своей роли</h3></div>${btn(user?'Начать практику':'Войти и перейти к практике','start:'+id)}</div><p>Твоя роль - ${m.role.toLowerCase()}. Пройди шесть ситуаций, выбери действие и объясни решение.</p><div class="steps"><article class="step"><b>1 · Входная ситуация</b><span>Начни со своего решения. Затем выбери маршрут с поддержкой или самостоятельный.</span></article><article class="step"><b>2 · Три тренировки</b><span>С поддержкой будут пример и подсказки. В самостоятельном маршруте ситуации сложнее.</span></article><article class="step"><b>3 · Две итоговые задачи</b><span>Примени правило к другим случаям. Первые ответы и объяснения сохраняются.</span></article></div>${id==='telegram'?'<p class="note">В модуле сохранены исходное уведомление об изменении двухэтапной проверки, сравнение сообщений А и Б и новая ситуация с ограничением в 15 минут.</p>':id==='delivery'?'<p class="note">В модуле сохранены письмо о доплате, сравнение двух писем и итоговый возврат платы. Подозрительные фрагменты отмечаются прямо в тексте.</p>':''}</section>${id==='delivery'?`<div class="original-banner"><div><b>Прежний тренажёр доставки</b><p>Отдельная версия из второй работы с входной проверкой четырёх уведомлений и сохранением SVG.</p></div>${btn('Открыть тренажёр','original','secondary')}</div>`:''}`}
else{const completed=localResults.find(r=>r.module===id&&r.complete);panel.innerHTML=`<section class="panel practice-intro"><div class="module-tab-heading"><div><span class="eyebrow">Итоговая проверка</span><h3>Проверь перенос правила</h3></div>${btn(user?'Начать прохождение':'Войти и перейти к практике','start:'+id)}</div><p>После шести ситуаций появятся два вопроса с несколькими ответами и одно задание на сопоставление. Все девять заданий входят в итоговый балл. В них нужно самостоятельно выбрать действие, указать существенные детали и объяснить решение. Подсказка с разбором появляется после ответа.</p><p>Автоматически проверяются действие и отметки в сообщении, если они предусмотрены. Текстовое объяснение сохраняется для преподавателя и не получает автоматический балл.</p>${completed?`<div class="note">У тебя уже есть завершённое прохождение. Результат первого выбора ${completed.firstScore} из ${completed.questionCount||completed.caseIds?.length||3}.</div><div class="button-row">${btn('Открыть мои результаты','progress','secondary')}</div>`:'<p class="note">Сначала пройди входную ситуацию и тренировку. Отдельно пропустить их и получить итоговый результат нельзя.</p>'}</section>`}

if (tab === 'theory' || tab === 'examples') addTermTips(panel);
const footer = document.createElement('div');
footer.className = 'module-footer-actions';
const action = panel.querySelector('.module-tab-heading > button');
if (action && tab !== 'practice') {
  footer.append(action.cloneNode(true));
  panel.append(footer);
}
const buttons=[...document.querySelectorAll('.module-tabs [role=tab]')];buttons.forEach((b,i)=>b.onkeydown=e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;const key=tabs[next][0];navigate('module/'+id+'/'+key);requestAnimationFrame(()=>document.getElementById('tab-'+key)?.focus({preventScroll:true}))}})}

const glossaryWords=[['Фишинг','Попытка обманом получить данные, доступ к аккаунту или заставить выполнить опасное действие.'],['Отправитель','Человек или сервис, от имени которого пришло сообщение. Отображаемое имя само по себе не подтверждает личность.'],['Независимая проверка','Проверка через знакомое приложение, ранее известный сайт или контакт, без использования адресов из подозрительного сообщения.'],['Домен','Часть адреса, указывающая на сайт. Похожее написание не подтверждает принадлежность организации.'],['HTTPS','Защищённое соединение с сайтом. Само по себе не гарантирует, что сайт принадлежит нужной организации.'],['Код подтверждения','Одноразовый код для определённого действия, например входа или перевода. Его назначение нужно читать в уведомлении.'],['CVC','Код карты, который нельзя передавать собеседнику или вводить на странице из непроверенного сообщения.'],['Социальная инженерия','Воздействие на человека через доверие, страх, спешку или обещание выгоды, чтобы он выполнил нужное действие.'],['QR-код','Изображение, которое может содержать адрес страницы. Его форма не подтверждает безопасность перехода.'],['Двухэтапная проверка','Дополнительный способ защиты входа. Она не делает безопасной передачу кодов или паролей другому человеку.'],['Макросы','Команды внутри документа, которые автоматически выполняют действия. Макросы в неожиданном вложении могут запустить нежелательные действия на устройстве.']];
function glossary(){main.innerHTML=head('Словарь курса','Глоссарий','Термины, которые встречаются в примерах и заданиях.')+`<div class="glossary-grid">${glossaryWords.map(([word,text])=>`<article class="panel"><h3>${word}</h3><p>${text}</p></article>`).join('')}</div>`}
const glossaryPatterns = [
  'фишинг[а-яё]*', 'отправител[а-яё]*', 'независим[а-яё]* проверк[а-яё]*',
  'домен[а-яё]*', 'https', 'код[а-яё]* подтверждения', 'cvc',
  'социальн[а-яё]* инженери[а-яё]*', 'qr[-‑–]код[а-яё]*',
  'двухэтапн[а-яё]* (?:проверк|аутентификаци)[а-яё]*', 'макрос[а-яё]*'
];
const termsPattern = new RegExp(
  '(?<![\\p{L}\\p{N}])(?:' + glossaryPatterns.map(pattern => '(' + pattern + ')').join('|') +
  ')(?![\\p{L}\\p{N}])', 'giu'
);
const termTip = document.createElement('div');
termTip.id = 'term-tip';
termTip.className = 'term-tip';
termTip.setAttribute('role', 'tooltip');
termTip.hidden = true;
document.body.append(termTip);
let currentTerm;

function hideTermTip() {
  currentTerm?.removeAttribute('aria-describedby');
  currentTerm = null;
  termTip.hidden = true;
}

function showTermTip(button, [term, definition]) {
  hideTermTip();
  currentTerm = button;
  button.setAttribute('aria-describedby', termTip.id);
  termTip.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = term;
  termTip.append(title, document.createTextNode(definition));
  termTip.hidden = false;
  const rect = button.getBoundingClientRect();
  const left = Math.min(rect.left, document.documentElement.clientWidth - termTip.offsetWidth - 12);
  const below = rect.bottom + 8;
  const top = below + termTip.offsetHeight < window.innerHeight - 8
    ? below : rect.top - termTip.offsetHeight - 8;
  termTip.style.left = Math.max(12, left) + 'px';
  termTip.style.top = Math.max(8, top) + 'px';
}

function addTermTips(panel, selector = 'p') {
  panel.querySelectorAll(selector).forEach(paragraph => {
    const nodes = [...paragraph.childNodes].filter(node => node.nodeType === Node.TEXT_NODE);
    const seen = new Set();
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      let end = 0;
      for (const match of node.textContent.matchAll(termsPattern)) {
        const index = match.slice(1).findIndex(Boolean);
        if (seen.has(index)) continue;
        seen.add(index);
        fragment.append(node.textContent.slice(end, match.index));
        const word = document.createElement('span');
        word.className = 'term-word';
        word.append(match[0]);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'term-help';
        button.textContent = '?';
        button.setAttribute('aria-label', 'Что значит «' + glossaryWords[index][0] + '»');
        const show = () => showTermTip(button, glossaryWords[index]);
        button.onpointerenter = event => { if (event.pointerType === 'mouse') show(); };
        button.onpointerleave = () => { if (currentTerm === button && document.activeElement !== button) hideTermTip(); };
        button.onfocus = show;
        button.onblur = () => { if (currentTerm === button) hideTermTip(); };
        button.onclick = show;
        word.append(button);
        fragment.append(word);
        end = match.index + match[0].length;
      }
      if (end) {
        fragment.append(node.textContent.slice(end));
        node.replaceWith(fragment);
      }
    }
  });
}

document.addEventListener('pointerdown', event => {
  if (!event.target.closest('.term-help')) hideTermTip();
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') hideTermTip(); });
window.addEventListener('scroll', hideTermTip, {passive:true});
window.addEventListener('resize', hideTermTip);

function closeMenus(){document.querySelectorAll('.nav-dropdown').forEach(el=>{el.classList.remove('open');delete el.dataset.pinned;el.querySelector('button').setAttribute('aria-expanded','false')})}
$('#modules-menu').innerHTML=modules.map((m,i)=>`<button data-action="module:${m.id}"><span class="menu-number">0${i+1}</span><span><b>${m.title}</b><small>${m.level}</small></span></button>`).join('');
const modulesDropdown = $('#modules-dropdown');
const modulesToggle = $('#modules-toggle');
function showModules() {
  modulesDropdown.classList.add('open');
  modulesToggle.setAttribute('aria-expanded', 'true');
}
modulesToggle.onclick = () => { closeMenus(); navigate('modules'); };
modulesToggle.onfocus = showModules;
modulesDropdown.onmouseenter = () => {
  if (matchMedia('(hover: hover)').matches) showModules();
};
modulesDropdown.onmouseleave = closeMenus;
modulesDropdown.addEventListener('focusout', event => {
  if (!modulesDropdown.contains(event.relatedTarget)) closeMenus();
});

function updateTopNav(page){const key=page.startsWith('module/')||['modules','play','original','examples','practice-hub','test-hub'].includes(page)?'modules':page==='glossary'?'glossary':page==='home'?'home':page==='about'?'about':null;const target=key==='modules'?$('#modules-toggle'):document.querySelector('[data-nav="'+key+'"]');document.querySelectorAll('.tabs>button,.tabs>.nav-dropdown>button').forEach(b=>{const active=b===target;b.classList.toggle('active',active);active?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current')});const nav=document.querySelector('.tabs');let indicator=nav.querySelector('.nav-indicator');if(!indicator){indicator=document.createElement('span');indicator.className='nav-indicator';indicator.setAttribute('aria-hidden','true');nav.prepend(indicator)}indicator.hidden = !target;if(target){const bounds=nav.getBoundingClientRect(),r=target.getBoundingClientRect();indicator.style.width=r.width+'px';indicator.style.height=r.height+'px';indicator.style.transform=`translate(${r.left-bounds.left-nav.clientLeft}px,${r.top-bounds.top-nav.clientTop}px)`}}
window.addEventListener('resize',()=>updateTopNav(location.hash.slice(1)||'home'));
document.addEventListener('click',e=>{if(!e.target.closest('.nav-dropdown'))closeMenus()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus()});
$('#to-top').onclick=()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});window.addEventListener('scroll',()=>$('#to-top').classList.toggle('visible',window.scrollY>450),{passive:true});
function drawChat() {
  const log = $('#chat-log');
  log.replaceChildren();
  if (!chat.length) {
    addBubble({text: 'Привет! Какое сообщение разберём?', role: 'assistant'});
  }
  for (const message of chat) addBubble(message);
  if (busy) addBubble({text: 'Обдумываю подсказку…', role: 'notice'});
  $('#chat-clear').disabled = busy || chat.length === 0;
  log.scrollTop = log.scrollHeight;
}

function addBubble({text, role, at, recommendation}) {
  const bubble = document.createElement('div');
  bubble.className = 'chat-message ' + role;
  const body = document.createElement('span');
  body.className = 'chat-text';
  body.textContent = text;
  bubble.append(body);

  const module = getModule(recommendation?.module);
  if (role === 'assistant' && module) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-module-link';
    button.textContent = (recommendation.completed ? 'Повторить ' : 'Открыть ') + '«' + module.title + '»';
    button.onclick = () => {
      const page = 'module/' + module.id + '/' + (recommendation.completed ? 'practice' : 'theory');
      navigate(page);
      if (location.hash === '#' + page) closeChat();
    };
    bubble.append(button);
  }

  if (at) {
    const date = new Date(at);
    if (!Number.isNaN(date.getTime())) {
      const time = document.createElement('time');
      time.className = 'chat-time';
      time.dateTime = date.toISOString();
      time.textContent = date.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit', hour12:false});
      time.title = date.toLocaleString();
      bubble.append(time);
    }
  }
  $('#chat-log').append(bubble);
}
function openChat(focusInput=true){$('#zico-panel').classList.remove('hidden');requestAnimationFrame(()=>{if($('#zico-open').getAttribute('aria-expanded')==='true')$('#zico-panel').classList.add('is-open')}); $('#zico-open').setAttribute('aria-expanded','true');drawChat();if(focusInput)$('#chat-input').focus()}
let closeTimer;function closeChat(restoreFocus=true){$('#zico-panel').classList.remove('is-open');clearTimeout(closeTimer);closeTimer=setTimeout(()=>{if(!$('#zico-panel').classList.contains('is-open'))$('#zico-panel').classList.add('hidden')},180);$('#zico-open').setAttribute('aria-expanded','false');if(restoreFocus)$('#zico-open').focus()}
const clearChat = document.createElement('button');
clearChat.type = 'button';
clearChat.id = 'chat-clear';
clearChat.className = 'chat-clear';
clearChat.textContent = 'Очистить чат';
clearChat.disabled = true;
$('#chat-form').append(clearChat);
clearChat.onclick = () => {
  if (busy || !confirm('Очистить переписку Zico в этом браузере?')) return;
  chat = [];
  saveChat();
  drawChat();
  $('#chat-input').focus();
};

$('#chat-form').onsubmit = async event => {
  event.preventDefault();
  if (busy) return;
  const text = $('#chat-input').value.trim();
  if (!text) return;
  if (!user || demo) {
    chat = [{role:'notice', text:'Чтобы получить подсказку Zico, войди в учебный аккаунт.'}];
    drawChat();
    return;
  }

  const sender = user;
  const activeRun = run;
  const pageModule = location.hash.match(/^#module\/([^/]+)/)?.[1];
  const module = location.hash === '#play' ? activeRun?.module : pageModule;
  const history = chat.filter(message => message.role !== 'notice').slice(-8)
    .map(({role, text}) => ({role, text}));

  busy = true;
  $('#chat-send').disabled = true;
  chat = chat.filter(message => message.role !== 'notice').slice(-59);
  chat.push({role:'user', text, at:new Date().toISOString()});
  saveChat();
  $('#chat-input').value = '';
  drawChat();

  try {
    const answer = await api('chat', {text, history, module});
    if (user !== sender) return;
    const recommendation = answer.recommendation;
    if (recommendation) {
      recommendation.completed ||= localResults.some(
        result => result.module === recommendation.module && result.complete
      );
    }
    chat = chat.slice(-59);
    chat.push({role:'assistant', text:answer.text, recommendation, at:new Date().toISOString()});
    saveChat();
    savedChatCount++;
    if (run && run === activeRun) run.helpCount++;
  } catch (error) {
    if (user === sender) chat.push({role:'notice', text:error.message});
  } finally {
    busy = false;
    $('#chat-send').disabled = false;
    drawChat();
  }
};
$('#zico-open').onclick=()=>$('#zico-open').getAttribute('aria-expanded')==='true'?closeChat():openChat();$('#zico-close').onclick=()=>closeChat();document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#zico-panel').classList.contains('hidden'))closeChat()});
document.addEventListener('pointerdown', event => {
  if ($('#zico-open').getAttribute('aria-expanded') !== 'true') return;
  if (!event.target.closest('#zico-panel, #zico-open, [data-action="zico"]')) closeChat(false);
});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action],[data-nav]');if(!b)return;const action=b.dataset.action||b.dataset.nav;if(['home','modules','progress','about','original','glossary','login'].includes(action)){navigate(action);return}if(action.startsWith('section:')){const [,id,target]=action.split(':');navigate('module/'+id+'/'+({'example':'examples','module-practice':'practice','module-test':'test'}[target]||'theory'));return}if(action.startsWith('tab:')){const [,id,tab]=action.split(':');navigate('module/'+id+'/'+tab);return}if(action.startsWith('module:')){navigate('module/'+action.split(':')[1]);return}if(action.startsWith('anchor:')){document.getElementById(action.split(':')[1])?.scrollIntoView({behavior:'smooth'});return}if(action==='course-map'){document.getElementById('course-map')?.scrollIntoView({behavior:'smooth'});return}if(['examples','practice-hub','test-hub'].includes(action)){navigate(action);return}if(action.startsWith('start:')){if(run&&!confirm('Начать заново?'))return;start(action.split(':')[1]);return}if(action==='zico')openChat();else if(action.startsWith('route:')){run.route=action.split(':')[1];run.caseIds=selectPracticeCases(getModule(run.module),shuffle,run.route);run.step=1;run.phase=run.route==='support'?'material':'question';run.order=shuffleOptions(run.caseIds[1]);render()}else if(action==='material-next'){run.phase='question';render()}else if(action==='retry'){if(run.answers.length>=60){toast('Слишком много повторных попыток. Начни новый разбор.');return}run.phase='question';run.order=shuffleOptions(run.caseIds[run.step]);render()}else if(action==='next'){if(run.step===0){run.phase='route';render()}else if(run.step===run.caseIds.length-1){run.phase='final-check';render();window.scrollTo(0,0)}else{run.step++;run.phase='question';run.order=shuffleOptions(run.caseIds[run.step]);render()}}else if(action.startsWith('png:')){
  const result = localResults.filter(item => item.complete && getModule(item.module))[Number(action.split(':')[1])];
  if (!result || b.disabled) return;
  b.disabled = true;
  try { await saveResultImage(result, user.username); }
  catch { toast('Не удалось подготовить PNG. Попробуй ещё раз.'); }
  finally { b.disabled = false; }
}else if(action.startsWith('detail:'))detail(Number(action.split(':')[1]));});
document.querySelector('.brand').onclick=e=>{e.preventDefault();navigate('home')};const accountButton = $('#account');
const accountWrap = document.createElement('div');
accountWrap.className = 'account-wrap';
accountButton.before(accountWrap);
accountWrap.append(accountButton);
accountWrap.insertAdjacentHTML('beforeend', `
  <div id="account-menu" class="account-menu" hidden>
    <strong id="account-name"></strong>
    <button type="button" class="link-button" data-action="progress">Мои результаты</button>
    <button type="button" class="link-button" id="logout-open">Выйти</button>
  </div>`);
document.body.insertAdjacentHTML('beforeend', `
  <dialog class="logout-dialog" aria-labelledby="logout-title">
    <span class="eyebrow">Учебный аккаунт</span>
    <h2 id="logout-title">Вы уверены, что хотите выйти?</h2>
    <div class="button-row">
      <button type="button" class="button secondary" id="logout-cancel" autofocus>Остаться</button>
      <button type="button" class="button primary" id="logout-confirm">Выйти</button>
    </div>
  </dialog>`);
const accountMenu = $('#account-menu');
const logoutDialog = $('.logout-dialog');

function showAccountMenu(open) {
  accountMenu.hidden = !open;
  if (user) accountButton.setAttribute('aria-expanded', String(open));
}

function renderAccount() {
  const name = user?.username || 'Просмотр';
  accountButton.classList.toggle('account-avatar', Boolean(user));
  accountButton.textContent = user ? name.slice(0,1).toUpperCase() : 'Войти';
  accountButton.setAttribute('aria-label', user ? 'Профиль ' + name : 'Войти');
  $('#account-name').textContent = name;
  if (user) accountButton.setAttribute('aria-controls', 'account-menu');
  else {
    accountButton.removeAttribute('aria-controls');
    accountButton.removeAttribute('aria-expanded');
  }
  showAccountMenu(false);
}

accountButton.onclick = () => {
  if (!user) { navigate('login'); return; }
  showAccountMenu(accountMenu.hidden);
};
document.addEventListener('click', event => {
  if (!accountWrap.contains(event.target)) showAccountMenu(false);
});
accountWrap.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    showAccountMenu(false);
    accountButton.focus();
  }
});
$('#logout-open').onclick = () => {
  showAccountMenu(false);
  logoutDialog.showModal();
};
logoutDialog.addEventListener('close', () => accountButton.focus());
$('#logout-cancel').onclick = () => logoutDialog.close();
$('#logout-confirm').onclick = async () => {
  const button = $('#logout-confirm');
  button.disabled = true;
  try {
    if (!demo) await api('auth', {action:'logout'});
    user = null;
    run = null;
    chat = [];
    localResults = [];
    $('#chat-input').value = '';
    drawChat();
    closeChat();
    demo = false;
    logoutDialog.close();
    navigate('home');
  } catch {
    logoutDialog.close();
    toast('Не удалось выйти на сервере. Попробуй ещё раз.');
  } finally {
    button.disabled = false;
  }
};

window.addEventListener('hashchange',()=>{if(run&&location.hash!=='#play'){if(confirm('Покинуть незавершённый разбор?'))run=null;else{location.hash='play';return}}render()});
let lastOriginal='';window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==document.querySelector('iframe')?.contentWindow||e.data?.type!=='delivery-result')return;const payload=e.data.payload;const sig=JSON.stringify(payload.final);if(sig===lastOriginal)return;lastOriginal=sig;write('zico.original.'+(user?.id||'guest'),payload);toast('Ответ исходного модуля сохранён в этом браузере. SVG можно скачать внутри модуля.');});
async function init(){try{const d=await api('auth');cloudReady=d.ready;user=d.user||null;if(user)loadLocal()}catch{}render()}init();

const composeInput=$('#chat-input');function resizeCompose(){composeInput.style.height='auto';composeInput.style.height=Math.min(composeInput.scrollHeight,100)+'px'}composeInput.addEventListener('input',resizeCompose);composeInput.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('#chat-form').requestSubmit()}});$('#chat-form').addEventListener('submit',()=>requestAnimationFrame(resizeCompose));

function showFinalCheck() {
  main.innerHTML = head('Итоговая проверка', getModule(run.module).title, 'Ответь на три задания. Каждый верный ответ добавит один балл.');
  const form = document.createElement('form');
  form.className = 'panel quick-check';
  form.innerHTML = `
    ${questions.map((question, i) => `<fieldset><legend>${question.title}</legend><p class="small muted">Отметь все подходящие варианты.</p>
      ${question.options.map((option, j) => `<label class="option"><input type="checkbox" name="q${i}" value="${j}"> ${option}</label>`).join('')}
    </fieldset>`).join('')}
    <fieldset><legend>Сопоставь ситуацию со способом проверки</legend>
      <p class="small muted">Перетащи карточку действия на ситуацию или выбери карточку и нажми на ситуацию.</p>
      <div class="matching-options">${[2,0,1].map(i => `<button type="button" class="button secondary match-card" data-card="${i}" aria-pressed="false">${pairs[i][1]}</button>`).join('')}</div>
      <div class="matching-targets">${pairs.map(([label],i) => `<button type="button" class="match-target" data-target="${i}"><strong>${label}</strong><span>Перетащи действие сюда</span></button>`).join('')}</div>
    </fieldset>
    <p class="error-text" role="alert"></p>
    <div class="button-row"><button class="button primary" type="submit">Посмотреть результат</button></div>`;
  main.append(form);
  const matching = Array(pairs.length).fill(-1);
  let selected = null;
  function assign(target, card) {
    if (card === null || !target) return;
    const previous = matching.indexOf(card);
    if (previous >= 0) matching[previous] = -1;
    matching[Number(target.dataset.target)] = card;
    form.querySelectorAll('[data-target]').forEach((button, i) => {
      button.querySelector('span').textContent = pairs[matching[i]]?.[1] || 'Перетащи действие сюда';
    });
    selected = null;
    form.querySelectorAll('[data-card]').forEach(button => button.setAttribute('aria-pressed','false'));
  }
  form.querySelectorAll('[data-card]').forEach(card => {
    const index = Number(card.dataset.card);
    card.onclick = () => {
      selected = index;
      form.querySelectorAll('[data-card]').forEach(button => button.setAttribute('aria-pressed', String(button === card)));
    };
    card.onpointerdown = event => {
      if (event.button !== 0) return;
      card.setPointerCapture(event.pointerId);
      const ghost = card.cloneNode(true);
      ghost.classList.add('match-ghost');
      ghost.setAttribute('aria-hidden','true');
      const move = point => {
        ghost.style.left = point.clientX + 12 + 'px';
        ghost.style.top = point.clientY + 12 + 'px';
      };
      card.onpointermove = point => {
        move(point);
        if (!ghost.isConnected) document.body.append(ghost);
      };
      card.onlostpointercapture = () => {
        ghost.remove();
        card.onpointermove = null;
      };
      card.onpointerup = point => assign(document.elementFromPoint(point.clientX,point.clientY)?.closest('[data-target]'), index);
    };
  });
  form.querySelectorAll('[data-target]').forEach(target => target.onclick = () => assign(target, selected));
  form.onsubmit = async event => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      run.finalCheck = gradeFinalCheck({multiple: questions.map((_,i) => data.getAll('q'+i).map(Number)), matching});
    } catch (error) {
      form.querySelector('[role=alert]').textContent = error.message;
      return;
    }
    form.querySelector('[type=submit]').disabled = true;
    await finish();
  };
}
