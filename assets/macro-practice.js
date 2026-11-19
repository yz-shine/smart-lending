const DATA={
 support:{
  sms:'Преподаватель (учебная группа): Отправляю ведомость группы 201-1. Откройте файл «Ведомость.docm» и нажмите «Включить макросы», иначе таблица не отобразится.',
  draft:'«Сообщение пришло от преподавателя, значит, файл безопасен. Включу макросы и открою таблицу».',
  worked:"<div class='note'><strong>Разобранный пример.</strong> Сообщение: «Вот расписание зачётов. Нажмите «Разрешить макросы» для просмотра». Сначала найди, что документ просит разрешить. Это макросы, поэтому проверять нужно именно эту просьбу. Слова «вот расписание» ничего не просят.</div>",
  phrases:['Отправляю ведомость группы 201-1.','Нажмите «Включить макросы», иначе таблица не отобразится.','Файл «Ведомость.docm»'],owner:1,
  hints:['Найди, что документ просит разрешить, и попробуй ещё раз.','Ищи фразу со словом «макросы». Остальные фразы ничего не просят сделать. Попробуй ещё раз.']
 },
 self:{
  sms:'Преподаватель (учебная группа): Срочно сдайте задание до 18:00. Откройте файл и разрешите макросы, иначе оценки не покажутся. Копия отправлена всей группе.',
  draft:'«Имя преподавателя знакомое, а срок близко. Разрешу макросы, чтобы не опоздать».',
  worked:'',
  phrases:['Срочно сдайте задание до 18:00.','Откройте файл и разрешите макросы, иначе оценки не покажутся.','Копия отправлена всей группе.'],owner:1,
  hints:['Найди, что документ просит разрешить, и попробуй ещё раз.']
 }
};
export const ACTS=[
 {t:'Включить макросы и открыть таблицу, чтобы успеть сдать задание',ok:false,
  why:'Макросы это команды внутри документа. Если включить их, они начнут работать на твоём устройстве. Знакомое имя в сообщении этого не проверяет.',
  hint:'Подумай, кто на самом деле мог прислать этот файл.'},
 {t:'Ответить в этой же переписке: «Это вы отправили файл?»',ok:false,
  why:'Ответит тот же отправитель, поэтому его слова ничего не подтверждают.',
  hint:'Нужен контакт, который ты знала раньше этого сообщения.'},
 {t:'Оставить макросы выключенными и написать преподавателю в привычный чат или на почту',ok:true,
  why:'Макросы остаются выключенными, а проверка идёт через контакт, который ты знала заранее. Так ответ не зависит от того, кто прислал файл.'}
];
const parts=['От: Преподаватель · сообщение в учебной группе','Файл «Ведомость.docm» просит: «Включите макросы, чтобы увидеть содержимое»','Проверка: написать преподавателю в привычный чат или на почту'];
const steps=[
 ['Посмотри, от чьего имени пришёл файл. Знакомое имя в сообщении не значит, что файл отправил этот человек.',0],
 ['Найди просьбу включить макросы. Макросы это команды внутри документа. Если включить их, документ сможет выполнять действия на твоём устройстве.',1],
 ['Оставь макросы выключенными и уточни у преподавателя через привычный чат или почту, отправлял ли он файл.',2]
];

export function showMacroPractice(container,{route,lesson,onContinue,onHelp,shuffle}){
  const scenario=DATA[route==='support'?'support':'self'];
  container.innerHTML=lesson?`
    <section class="panel"><h3>Что проверить перед открытием файла</h3>
    <div data-demo>${parts.map((p,i)=>`<p><code class="button secondary" data-part="${i}">${p}</code></p>`).join('')}</div>
    <p class="note" data-caption aria-live="polite"></p>
    <div class="button-row"><button class="button secondary" data-listen>Слушать</button>
    <button class="button secondary" data-stop>Стоп</button>
    <button class="button secondary" data-step>Следующий шаг схемы</button>
    <button class="button primary" data-continue disabled>К тренировке</button></div></section>`:`
    <section class="panel"><h3>Что делать с вложением?</h3><p class="note">${scenario.sms}</p>
    <p><strong>Рассуждение для проверки</strong></p><p>${scenario.draft}</p>${scenario.worked}
    <p>Нажми на фразу, которая требует проверки.</p><div class="button-row" data-task>${scenario.phrases.map((p,i)=>`<button type="button" class="button secondary" data-part="${i}">${p}</button>`).join('')}</div>
    <p class="note" data-phrase-feedback hidden role="status"></p>
    <section data-actions hidden><h3>Что сделаешь с файлом?</h3>
    <div class="button-row">${shuffle([0,1,2]).map(i=>`<button class="button secondary" data-choice="${i}">${ACTS[i].t}</button>`).join('')}</div></section>
    <p class="note" data-action-feedback hidden role="status"></p>
    <div class="button-row"><button class="button secondary" data-help>Спросить Zico</button>
    <button class="button primary" data-continue disabled>К итоговой проверке</button></div></section>`;
  const find=s=>container.querySelector(s);
  const stop=()=>window.speechSynthesis?.cancel();
  find('[data-continue]').onclick=()=>{if(lesson)stop();onContinue();};
  if(lesson){
    const caption=find('[data-caption]'),next=find('[data-step]');
    let index=0,playback=0;
    function show(step){
      index=step;caption.textContent=steps[step][0];
      find('[data-demo]').querySelectorAll('[data-part]').forEach(p=>{
        const on=Number(p.dataset.part)===steps[step][1];
        p.classList.toggle('primary',on);p.classList.toggle('secondary',!on);
      });
      next.disabled=step===steps.length-1;
      if(next.disabled)find('[data-continue]').disabled=false;
    }
    function cancel(){playback++;stop();}
    function speak(step,token){
      if(token!==playback||!caption.isConnected)return;
      show(step);
      const speech=new SpeechSynthesisUtterance(steps[step][0]);
      speech.lang='ru-RU';
      speech.onend=()=>{if(step+1<steps.length)speak(step+1,token);};
      speech.onerror=()=>{if(token===playback&&caption.isConnected)caption.textContent+=' Озвучка недоступна. Продолжи кнопкой «Следующий шаг схемы».';};
      window.speechSynthesis.speak(speech);
    }
    find('[data-listen]').onclick=()=>{
      cancel();
      if(window.speechSynthesis&&typeof SpeechSynthesisUtterance==='function')speak(0,playback);
      else caption.textContent+=' Озвучка недоступна. Шаги можно прочитать.';
    };
    find('[data-stop]').onclick=cancel;
    next.onclick=()=>{cancel();show(Math.min(index+1,steps.length-1));};
    show(0);
    return;
  }
  let misses=0;
  find('[data-help]').onclick=onHelp;
  find('[data-task]').onclick=event=>{
    const button=event.target.closest('[data-part]');
    if(!button)return;
    const feedback=find('[data-phrase-feedback]');
    const correct=Number(button.dataset.part)===scenario.owner;
    feedback.hidden=false;
    feedback.textContent=correct?'Верно. Именно эта фраза просит разрешить действие. Знакомое имя отправителя ничего не проверяет, как и знакомое слово в адресе.':'Эта фраза ничего не просит разрешить. '+scenario.hints[Math.min(misses++,scenario.hints.length-1)];
    if(correct){
      button.classList.replace('secondary','primary');
      find('[data-task]').querySelectorAll('button').forEach(o=>{o.disabled=true;});
      find('[data-actions]').hidden=false;
    }
  };
  let wrong=0;
  find('[data-actions]').onclick=event=>{
    const button=event.target.closest('[data-choice]');
    if(!button)return;
    const action=ACTS[Number(button.dataset.choice)];
    const feedback=find('[data-action-feedback]');
    feedback.hidden=false;
    if(action.ok){
      feedback.textContent='Верно. '+action.why;
      button.classList.replace('secondary','primary');
      find('[data-actions]').querySelectorAll('button').forEach(o=>{o.disabled=true;});
      find('[data-continue]').disabled=false;
    }else{
      wrong++;
      feedback.textContent=action.why+' '+action.hint+(route==='support'&&wrong>1&&scenario.worked?' Вспомни разобранный пример выше.':'')+' Выбери другой вариант.';
    }
  };
}
