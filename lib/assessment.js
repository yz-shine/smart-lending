import {getModule} from '../assets/content.js';
import {gradeChoice} from '../assets/course.js';
function invalid(message){throw Object.assign(Error(message),{status:400})}
export function normalizeResult(raw){
 const m=getModule(raw?.module);
 if(!m||typeof raw.id!=='string'||!/^[A-Za-z0-9-]{10,80}$/.test(raw.id)||!['support','independent'].includes(raw.route)||!Array.isArray(raw.answers)||raw.answers.length<3||raw.answers.length>80)invalid('Неверный формат результата.');
 // Старые трёхшаговые результаты остаются совместимыми с новым сервером.
 const caseIds=raw.caseIds??m.cases.slice(0,3).map(c=>c.id);
 if(!Array.isArray(caseIds)||![3,6].includes(caseIds.length)||new Set(caseIds).size!==caseIds.length||caseIds.some(id=>!m.cases.some(c=>c.id===id)))invalid('Неверный набор ситуаций.');
 const counters={};
 const answers=raw.answers.map(a=>{const c=m.cases.find(c=>c.id===a?.caseId);if(!c||!caseIds.includes(c.id)||!c.options.some(o=>o[0]===a.choice)||typeof a.reason!=='string'||a.reason.trim().length<10||a.reason.length>1200)invalid('Неверный формат ответа.');const evidence=a.evidence??[];if(!Array.isArray(evidence)||new Set(evidence).size!==evidence.length||evidence.some(id=>!c.evidence?.some(e=>e[0]===id)))invalid('Неверные отметки в сообщении.');return {caseId:c.id,choice:a.choice,reason:a.reason.trim(),evidence,correct:gradeChoice(c,a.choice,evidence),attempt:counters[c.id]=(counters[c.id]||0)+1}});
 if(caseIds.some(id=>!answers.some(a=>a.caseId===id)))invalid('Нужны ответы на все ситуации.');
 return {id:raw.id,module:m.id,caseIds,questionCount:caseIds.length,route:raw.route,answers,firstScore:caseIds.filter(id=>answers.find(a=>a.caseId===id).correct).length,finalCorrect:answers.filter(a=>a.caseId===caseIds.at(-1)).at(-1).correct,complete:true,chatCount:Number.isInteger(raw.chatCount)?Math.max(0,Math.min(raw.chatCount,100)):0,startedAt:typeof raw.startedAt==='string'&&!isNaN(Date.parse(raw.startedAt))?raw.startedAt:null,finishedAt:new Date().toISOString(),note:'Объяснения требуют проверки преподавателем. Автоматическая оценка проверяет действие и отметки; самостоятельность прохождения не удостоверяется.'};
}
