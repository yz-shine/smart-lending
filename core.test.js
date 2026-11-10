import test from 'node:test';import assert from 'node:assert/strict';
import {modules,shuffle} from '../assets/content.js';import {normalizeResult} from '../lib/assessment.js';import {hashPassword,verifyPassword,post} from '../lib/db.js';
test('27 уникальных ситуаций, по 4 различных варианта и один ключ',()=>{const ids=modules.flatMap(m=>m.cases.map(c=>c.id));assert.equal(new Set(ids).size,27);for(const m of modules)for(const c of m.cases){assert.equal(c.options.length,4);assert.equal(c.options.filter(o=>o[0]===c.correct).length,1);assert.equal(new Set(c.options.map(o=>o[1])).size,4)}});
test('перемешивание сохраняет варианты, не меняя исходник',()=>{const a=[1,2,3,4];assert.deepEqual(shuffle(a,()=>0),[2,3,4,1]);assert.deepEqual(a,[1,2,3,4])});
const raw=()=>({id:'test-12345678',module:'telegram',route:'support',firstScore:99,answers:modules[0].cases.slice(0,3).map(c=>({caseId:c.id,choice:'b',reason:'Я проверю источник сообщения самостоятельно.',correct:true}))});
test('сервер пересчитывает баллы и сохраняет первую ошибку',()=>{const r=raw();r.answers.splice(1,0,{...r.answers[0],choice:'a'});const n=normalizeResult(r);assert.equal(n.firstScore,0);assert.equal(n.answers[0].correct,false);assert.equal(n.answers[1].correct,true);assert.equal(n.answers[1].attempt,2)});
test('неполные и слишком длинные данные отклоняются',()=>{const r=raw();r.answers.pop();assert.throws(()=>normalizeResult(r));const v=raw();v.answers[0].reason='x'.repeat(1201);assert.throws(()=>normalizeResult(v))});
test('пароли имеют соль и проверяются по хешу',async()=>{const a=await hashPassword('test-password-123');const b=await hashPassword('test-password-123');assert.notEqual(a,b);assert.ok(await verifyPassword('test-password-123',a));assert.equal(await verifyPassword('wrong-password',a),false)});
test('запросы с другого origin отклоняются',()=>{assert.throws(()=>post({method:'POST',headers:{origin:'https://evil.example',host:'learn.example','content-type':'application/json'}}));assert.doesNotThrow(()=>post({method:'POST',headers:{origin:'https://learn.example',host:'learn.example','content-type':'application/json'}}))});

import {resolveReply,hints,fallback} from '../lib/zico-policy.js';
test('Zico не выводит произвольный ответ модели',()=>{assert.equal(resolveReply({category:'HINT',hint:'invented',text:'wrong answer'}),fallback);assert.equal(resolveReply({category:'READY_ANSWER'}),hints.practice);assert.equal(resolveReply({category:'INSUFFICIENT'}),fallback);assert.equal(resolveReply({category:'OUT_OF_SCOPE'}),'Я помогаю только с распознаванием фишинговых сообщений и заданиями этого курса.');assert.equal(resolveReply({category:'HINT',hint:'https'}),hints.https)});

import {selectPracticeCases,gradeChoice} from '../assets/course.js';
test('по шесть уникальных ситуаций во всех модулях и исходные задания на границах',()=>{for(const m of modules){const ids=selectPracticeCases(m,shuffle);assert.equal(ids.length,6);assert.equal(new Set(ids).size,6);assert.ok(ids.every(id=>m.cases.some(c=>c.id===id)))}assert.equal(selectPracticeCases(modules[0],shuffle)[0],'tg-original-entry');assert.equal(selectPracticeCases(modules[0],shuffle).at(-1),'tg-original-final');assert.equal(selectPracticeCases(modules[1],shuffle).at(-1),'dl-original-final')});
test('сервер считает шесть заданий и не принимает отметки всех фрагментов',()=>{const m=modules[0],ids=selectPracticeCases(m,shuffle),answers=ids.map(id=>{const c=m.cases.find(c=>c.id===id);return {caseId:id,choice:c.correct,reason:'Я проверю ситуацию через знакомое приложение.',evidence:c.evidence?.filter(e=>e[2]).map(e=>e[0])||[]}});const r=normalizeResult({...raw(),caseIds:ids,answers});assert.equal(r.questionCount,6);assert.equal(r.firstScore,6);const c=m.cases.find(c=>c.id===ids[0]);assert.equal(gradeChoice(c,c.correct,c.evidence.map(e=>e[0])),false);answers[0].evidence.push('unknown');assert.throws(()=>normalizeResult({...raw(),caseIds:ids,answers}))});

test('маршруты различаются тренировкой и сохраняют общую проверку', () => {
  for (const module of modules) {
    const support = selectPracticeCases(module, shuffle, 'support');
    const independent = selectPracticeCases(module, shuffle, 'independent');
    assert.equal(support[0], independent[0]);
    assert.deepEqual(support.slice(-2), independent.slice(-2));
    assert.ok(support.slice(1, 4).every(id => !independent.includes(id)));
    for (const [route, caseIds] of [['support', support], ['independent', independent]]) {
      const answers = caseIds.map(id => {
        const item = module.cases.find(c => c.id === id);
        return {caseId:id, choice:item.correct, reason:'Проверю просьбу через известный канал.', evidence:item.evidence?.filter(e => e[2]).map(e => e[0]) || []};
      });
      assert.equal(normalizeResult({id:'route-test-123', module:module.id, route, caseIds, answers}).firstScore, 6);
    }
  }
});
