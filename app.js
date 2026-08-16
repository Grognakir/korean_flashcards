
(function(){
"use strict";

/* ============ DATA ============ */
var RAW, GRAMMAR_TOPICS, GRAMMAR_EXERCISES, EXAM_DATA, QA_DATA, THEME_DATA, PHRASES_RAW;
var EXAM_LABELS = ['가','나','다','라'];
var ALL_WORDS, CATEGORIES, GRAMMAR_CATS, EX_CAT_MAP;
var RELATED_BY_KR, WORDS_BY_ID;
var ALL_PHRASES, PHRASE_CATEGORIES, PHRASES_BY_ID;

function initData(){
  ALL_WORDS = [];
  RAW.forEach(function(cat){
    cat.words.forEach(function(w, wi){
      ALL_WORDS.push({ id: cat.category+'::'+wi+'::'+w.kr, category: cat.category, kr: w.kr, translit: w.translit, meaning: w.meaning, notes: w.notes || '', related: w.related || null, examples: w.examples || null });
    });
  });
  CATEGORIES = RAW.map(function(c){ return c.category; });
  WORDS_BY_ID = {};
  ALL_WORDS.forEach(function(w){ WORDS_BY_ID[w.id] = w; });
  ALL_PHRASES = [];
  PHRASES_RAW.forEach(function(cat){
    cat.phrases.forEach(function(p, pi){
      ALL_PHRASES.push({ id: 'phrase::'+cat.category+'::'+pi+'::'+p.kr, category: cat.category, kr: p.kr, translit: p.translit, meaning: p.meaning, notes: p.notes || '' });
    });
  });
  PHRASE_CATEGORIES = PHRASES_RAW.map(function(c){ return c.category; });
  PHRASES_BY_ID = {};
  ALL_PHRASES.forEach(function(p){ PHRASES_BY_ID[p.id] = p; });
  GRAMMAR_CATS = GRAMMAR_TOPICS.map(function(t){ return t.category; });
  EX_CAT_MAP = {};
  GRAMMAR_CATS.forEach(function(full){
    var short = shortGrammarCat(full).split(/\s*[(—]/)[0].trim();
    EX_CAT_MAP[short] = full;
  });
  RELATED_BY_KR = {};
  function link(a, b){
    (RELATED_BY_KR[a] = RELATED_BY_KR[a] || {})[b] = true;
  }
  ALL_WORDS.forEach(function(w){
    if(w.related && w.related.target){ link(w.kr, w.related.target); link(w.related.target, w.kr); }
  });
}
/* ---- антонимы/синонимы: чтобы пара слова попадала в ту же подборку ---- */
function partnerKrs(word){ return Object.keys(RELATED_BY_KR[word.kr] || {}); }
function expandWithPairs(words, allowedPool){
  var byKr = {};
  allowedPool.forEach(function(w){ if(!byKr[w.kr]) byKr[w.kr] = w; });
  var haveIds = {};
  var result = words.slice();
  result.forEach(function(w){ haveIds[w.id] = true; });
  for(var i=0;i<result.length;i++){ // растущий список: новые партнёры тоже проверяются на свою пару (транзитивно)
    partnerKrs(result[i]).forEach(function(kr){
      var partner = byKr[kr];
      if(partner && !haveIds[partner.id]){ result.push(partner); haveIds[partner.id] = true; }
    });
  }
  return result;
}
function orderWithPairsAdjacent(words){
  var byKr = {};
  words.forEach(function(w){ if(!byKr[w.kr]) byKr[w.kr] = w; });
  var used = {};
  var result = [];
  words.forEach(function(w){
    if(used[w.id]) return;
    result.push(w); used[w.id] = true;
    partnerKrs(w).forEach(function(kr){
      var p = byKr[kr];
      if(p && !used[p.id]){ result.push(p); used[p.id] = true; }
    });
  });
  return result;
}
function orderQuestionsWithPairsAdjacent(items){
  function wordOf(item){
    var q = item.q || item;
    return q.word || null;
  }
  var byKr = {};
  items.forEach(function(item){ var w = wordOf(item); if(w && !byKr[w.kr]) byKr[w.kr] = item; });
  var used = {};
  var result = [];
  items.forEach(function(item, idx){
    if(used[idx]) return;
    result.push(item); used[idx] = true;
    var w = wordOf(item);
    if(!w) return;
    partnerKrs(w).forEach(function(kr){
      var pItem = byKr[kr];
      if(!pItem) return;
      var pIdx = items.indexOf(pItem);
      if(pIdx !== -1 && !used[pIdx]){ result.push(pItem); used[pIdx] = true; }
    });
  });
  return result;
}
var SHORT_NAMES = {
  'Неправильные глаголы/прилагательные — ㄷ (ㄷ받침 → ㄹ перед гласной)': 'Неправ. глаг. — ㄷ',
  'Неправильные глаголы/прилагательные — ㄹ받침 (ведут себя по-другому только в некоторых окончаниях)': 'Неправ. глаг. — ㄹ받침',
  'Неправильные глаголы/прилагательные — ㅂ (ㅂ받침 → 우/오 перед гласной)': 'Неправ. глаг. — ㅂ',
  'Неправильные глаголы/прилагательные — ㅡ (выпадение гласной + отдельно 르-неправильные)': 'Неправ. глаг. — ㅡ/르',
  'Положение в пространстве': 'Положение в пр-ве',
  'Одежда и внешний вид': 'Одежда и вид',
  'Бизнес и экономика': 'Бизнес и эконом.',
  'Дни недели и даты': 'Дни и даты',
  'Наречия (образа действия)': 'Наречия действия',
  'Грамматические термины': 'Грам. термины',
  'Соединительные окончания (연결어미)': 'Соед. окончания',
  'Счётные слова (의존명사)': 'Счётные слова',
  'Семья и обращения': 'Семья'
};
function shortCat(c){ return SHORT_NAMES[c] || c; }
function shortGrammarCat(c){ return c.replace(/^\d+\.\s*/, ''); }
var LESSON_CATEGORIES = {
  // 1과: N이/가, N은/는①, N도, N이/가 아니다, N입니다 — самопредставление, кто есть кто, откуда
  1: ['Местоимения','Страны','Профессии','Разговорные выражения'],
  // 2과: 이/그/저, N의, N에①, N이/가 있다/없다 — где что лежит, чьи вещи
  2: ['Положение в пространстве','Бытовые предметы'],
  // 3과: V(스)ㅂ니다, N을/를, N만, 수① — формальные глаголы впервые вводятся здесь + числительные①
  3: ['Глаголы','Числительные'],
  // 4과: N와/과, N하고, N에서, 수②, N에② — перечисление, календарь
  4: ['Продукты и еда','Дни недели и даты'],
  // 5과: V아/어요①, N이에요/예요, 수③(цены), 안/지 않다 — покупки, вопросы, отрицание
  5: ['Одежда и внешний вид','Вопросительные слова'],
  // 6과: V았/었-, V고①, 아/어 보다, ㅡ탈락 — прошедшее время, рассказ о дне, именно здесь ㅡ-неправильные
  6: ['Учёба','Неправильные глаголы/прилагательные — ㅡ (выпадение гласной + отдельно 르-неправильные)'],
  // 7과: N은/는②, ㅂ불규칙, 아/어서①, (으)러 가다/오다 — самочувствие (большинство ㅂ-неправ. про тело), поход куда-то по причине
  7: ['Части тела','Неправильные глаголы/прилагательные — ㅂ (ㅂ받침 → 우/오 перед гласной)','Больница и отделения','Лекарства'],
  8: ['Время суток','Временные наречия'],
  // 9과: 수④, (으)세요/십시오, 고 있다①, 에게(서)/한테(서) — инструкции по пользованию, числительные для счётных слов
  9: ['Счётные слова (의존명사)','Электроника'],
  // 10과: (으)ㄹ까요?①, (으)ㅂ시다, 고 싶다 — «давай вместе», совместные предложения
  10: ['Спорт','Жанры фильмов'],
  // 11과: 지요?, 아/어 주다, ㄷ불규칙, (으)면 — просьбы об услуге («не подскажете, где...»), именно здесь ㄷ-неправильные
  11: ['Места','Неправильные глаголы/прилагательные — ㄷ (ㄷ받침 → ㄹ перед гласной)'],
  // 12과: 아/어서②, (으)ㄹ 수 있다/없다 — готовка/еда + возможность
  12: ['Овощи','Фрукты'],
  // 13과: N(으)로②(транспорт), ㄹ받침, 거나, 못/지 못하다 — именно здесь ㄹ받침-неправильные
  13: ['Неправильные глаголы/прилагательные — ㄹ받침 (ведут себя по-другому только в некоторых окончаниях)','Наречия (образа действия)'],
  // 14과: N께서, V(으)시-, 아/어야 되다, 지 말다 — уважительная речь именно про семью/старших
  14: ['Семья и обращения','Бытовые дела'],
  // 15과: N보다, DV(으)ㄴ N — сравнение и определительная форма прилагательных
  15: ['Прилагательные'],
  // 16과: AV determiner-формы, N인 N, (으)ㄴ/는데, N께, 아/어 드리다 — сложные конструкции для описания чего угодно
  16: ['Прочее','Грамматические термины','Частицы','Союзы и связки','Соединительные окончания (연결어미)']
};
// «Бизнес и экономика» — лексика уровня выше начального (기업, 매출, 발령, 재벌, 중공업 и т.п.),
// реальной привязки к грамматике этих 16 уроков нет — намеренно не включена в «по теме»,
// доступна только через «по категории».
function categoriesForLessons(lessons){
  var set = {};
  lessons.forEach(function(l){ (LESSON_CATEGORIES[l] || []).forEach(function(c){ set[c] = true; }); });
  return Object.keys(set);
}
function exCatFull(e){ return EX_CAT_MAP[e.cat] || e.cat; }

/* ============ HELPERS ============ */
function extractExamples(word){
  var notes = word.notes || '';
  var re = /([^;.,()]*[\uAC00-\uD7A3][^\u2014]*)\u2014\s*([^;]+)/g;
  var m, out = [];
  while((m = re.exec(notes))){
    var krSent = m[1].trim();
    var ruTrans = m[2].trim();
    var stem = word.kr.replace(/\ub2e4$/,'');
    if(krSent.length > 1 && krSent.length < 60 && (krSent.indexOf(word.kr) !== -1 || krSent.indexOf(stem) !== -1)){
      out.push({kr: krSent, ru: ruTrans});
    }
  }
  return out;
}
function blankSentence(sentenceKr, wordKr){
  var stem = wordKr.replace(/\ub2e4$/, '');
  var idx = sentenceKr.indexOf(wordKr);
  var matchLen = wordKr.length;
  if(idx === -1){
    idx = sentenceKr.indexOf(stem);
    if(idx !== -1){
      var end = sentenceKr.indexOf(' ', idx);
      if(end === -1) end = sentenceKr.length;
      matchLen = end - idx;
    }
  }
  if(idx === -1) return null;
  return { before: sentenceKr.slice(0, idx), after: sentenceKr.slice(idx + matchLen), matched: sentenceKr.slice(idx, idx+matchLen) };
}
function firstExampleBlank(word){
  if(word.examples && word.examples.length){
    for(var i=0;i<word.examples.length;i++){
      var ex = word.examples[i];
      var idx = ex.kr.indexOf(ex.form);
      if(idx !== -1){
        return { example: {kr: ex.kr, ru: ex.ru}, blank: { before: ex.kr.slice(0, idx), after: ex.kr.slice(idx+ex.form.length), matched: ex.form } };
      }
    }
  }
  var exs = extractExamples(word);
  for(var j=0;j<exs.length;j++){
    var b = blankSentence(exs[j].kr, word.kr);
    if(b) return {example: exs[j], blank: b};
  }
  return null;
}
function shuffle(arr){
  var a = arr.slice();
  for(var i=a.length-1;i>0;i--){ var j = Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}
function sample(arr, n){ return shuffle(arr).slice(0, n); }
function esc(s){ var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function mdRich(s){
  var e = esc(s);
  e = e.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  e = e.replace(/[가-힣ᄀ-ᇿ㄰-㆏]+/g, '<span class="kr-hl">$&</span>');
  return e;
}
function resetIconBtn(id, title){ return '<div class="reset-row"><button class="btn-icon-sm" id="' + id + '" title="' + esc(title || 'Сбросить прогресс и перемешать') + '">\u21BB</button></div>'; }

/* ============ QUESTION FACTORIES ============ */
function distractorMeanings(word, n, pool){
  pool = pool || ALL_WORDS;
  var p = pool.filter(function(w){ return w.id !== word.id && w.meaning !== word.meaning; });
  return sample(p, n).map(function(w){ return w.meaning; });
}
function distractorWords(word, n, pool){
  pool = pool || ALL_WORDS;
  var p = pool.filter(function(w){ return w.id !== word.id && w.kr !== word.kr; });
  return sample(p, n);
}
function qCard(word){ return {type:'card', word:word}; }
function qKr2Ru(word, pool){
  var opts = shuffle([word.meaning].concat(distractorMeanings(word, 4, pool)));
  return {type:'kr2ru', word:word, options: opts};
}
function qRu2Kr(word, pool){
  var distractors = distractorWords(word, 4, pool);
  var opts = shuffle([word].concat(distractors));
  return {type:'ru2kr', word:word, options: opts};
}
function qSentChoice(word){
  var fb = firstExampleBlank(word);
  if(!fb) return null;
  var distractors = distractorWords(word, 4);
  var opts = shuffle([word].concat(distractors));
  return {type:'sentchoice', word:word, example: fb.example, blank: fb.blank, options: opts};
}
function qSpell(word){ return {type:'spell', word:word}; }
function qSentType(word){
  var fb = firstExampleBlank(word);
  if(!fb) return null;
  return {type:'senttype', word:word, example: fb.example, blank: fb.blank};
}
function qGrammar(ex){
  var opts = shuffle(ex.options.slice());
  return {type:'grammar', ex: ex, options: opts};
}
function qGrammarCard(item){ return {type:'gramcard', item: item}; }
function qGrammarSpell(item){ return {type:'gramspell', item: item}; }

/* ---- Экзамен: чтение ---- */
function qExamReading(item){
  return {type:'exread', item: item, options: shuffle(item.options.slice())};
}
/* ---- Экзамен: аудирование (локальные файлы, вне git) ---- */
function qExamListening(item){
  return {type:'exlisten', item: item, options: shuffle(item.options.slice())};
}
/* ---- Экзамен: чтение TOPIK (локальные файлы, вне git) ---- */
function qExamTopikReading(item){
  return {type:'extopikread', item: item, options: shuffle(item.options.slice())};
}
/* ---- Экзамен: порядок предложений ---- */
function permutations4(){
  var base = [0,1,2,3];
  var out = [];
  function permute(arr, m){
    if(arr.length === 0) out.push(m);
    else { for(var i=0;i<arr.length;i++){
      var cur = arr.slice(); var next = cur.splice(i,1);
      permute(cur, m.concat(next));
    }}
  }
  permute(base, []);
  return out;
}
var ALL_PERMS_4 = permutations4();
function qExamOrdering(item){
  var correctLabel = item.correct_order.map(function(i){ return EXAM_LABELS[i]; }).join('-');
  var pool = ALL_PERMS_4.filter(function(p){ return p.join('-') !== item.correct_order.join('-'); });
  var distractorPerms = sample(pool, 3);
  var distractorLabels = distractorPerms.map(function(p){ return p.map(function(i){ return EXAM_LABELS[i]; }).join('-'); });
  var options = shuffle([correctLabel].concat(distractorLabels));
  return {type:'exorder', item: item, options: options, correctLabel: correctLabel};
}
/* ---- Экзамен: собери предложение ---- */
function qExamConstruct(item){
  var words = item.words.map(function(w, i){ return {text: w, key: i+'-'+w}; });
  return {type:'excon', item: item, shuffled: shuffle(words)};
}
/* ---- Экзамен: вставь выражение ---- */
function qExamCloze(item){
  return {type:'excloze', item: item, options: shuffle(item.options.slice())};
}

/* ---- Вопросы: вопросительное слово ---- */
function qQWord(item){
  return {type:'qword', item: item, options: shuffle(item.options.slice())};
}
/* ---- Вопросы: вопрос -> ответ ---- */
function qQAnswer(item){
  return {type:'qanswer', item: item, options: shuffle(item.options.slice())};
}
/* ---- Вопросы: ответные слова и связки ---- */
function qResponse(item){
  return {type:'response', item: item, options: shuffle(item.options.slice())};
}

/* ---- Темы: cloze (счётные слова / уважительно / место) ---- */
function qThemeCloze(item){
  return {type:'themecloze', item: item, options: shuffle(item.options.slice())};
}
/* ---- Темы: даты и время (вопрос -> выбери правильное чтение) ---- */
function qThemeDate(item){
  return {type:'themedate', item: item, options: shuffle(item.options.slice())};
}
var SINO_NUMBER_DIGITS = ['영','일','이','삼','사','오','육','칠','팔','구'];
var NATIVE_NUMBER_ONES = {1:'하나',2:'둘',3:'셋',4:'넷',5:'다섯',6:'여섯',7:'일곱',8:'여덟',9:'아홉'};
var NATIVE_NUMBER_COUNTER_ONES = {1:'한',2:'두',3:'세',4:'네',5:'다섯',6:'여섯',7:'일곱',8:'여덟',9:'아홉'};
var NATIVE_NUMBER_TENS = {10:'열',20:'스물',30:'서른',40:'마흔',50:'쉰',60:'예순',70:'일흔',80:'여든',90:'아흔'};
function sinoUnder10000(n){
  var units = [[1000,'천'],[100,'백'],[10,'십'],[1,'']];
  var out = '';
  units.forEach(function(unit){
    var digit = Math.floor(n / unit[0]) % 10;
    if(!digit) return;
    if(unit[0] === 1 || digit !== 1) out += SINO_NUMBER_DIGITS[digit];
    out += unit[1];
  });
  return out;
}
function sinoNumber(n){
  if(n === 0) return '영';
  if(n < 10000) return sinoUnder10000(n);
  var high = Math.floor(n / 10000);
  var low = n % 10000;
  var highText = (high === 1 ? '' : sinoNumber(high)) + '만';
  return highText + (low ? ' ' + sinoUnder10000(low) : '');
}
function nativeNumber(n){
  if(n < 1 || n > 99) return null;
  if(n < 10) return NATIVE_NUMBER_ONES[n];
  var tens = Math.floor(n / 10) * 10;
  var ones = n % 10;
  return NATIVE_NUMBER_TENS[tens] + (ones ? NATIVE_NUMBER_ONES[ones] : '');
}
function nativeCounterNumber(n){
  if(n < 1 || n > 99) return null;
  var tens = n >= 10 ? NATIVE_NUMBER_TENS[Math.floor(n / 10) * 10] : '';
  var ones = n % 10;
  if(!ones) return n === 20 ? '스무' : tens;
  return tens + NATIVE_NUMBER_COUNTER_ONES[ones];
}
function numberOptions(correct, candidates){
  var options = [correct];
  candidates.forEach(function(option){
    if(option != null && options.indexOf(String(option)) === -1) options.push(String(option));
  });
  return options.slice(0, 4);
}
function numericNumberOptions(n){
  return [n+1, Math.max(0,n-1), n+10, n+100, Math.max(0,n-10)].map(String);
}
function sinoReadingOptions(n){
  if(n === 0) return ['공','하나','일','십'];
  var candidates = [];
  if(n < 100){ candidates.push(nativeNumber(n), nativeCounterNumber(n)); }
  candidates.push(sinoNumber(n+1), sinoNumber(Math.max(0,n-1)), sinoNumber(n+10), sinoNumber(n+100));
  return candidates;
}
function nativeReadingOptions(n){
  return [sinoNumber(n), nativeCounterNumber(n), nativeNumber(Math.min(99,n+1)), nativeNumber(Math.max(1,n-1)), nativeNumber(Math.min(99,n+10)), nativeNumber(Math.max(1,n-10))];
}
function buildNumberExercises(){
  var items = [];
  var seq = 0;
  var sinoNote = 'Корейско-китайские числительные используются с минутами, датами, деньгами, этажами и числами от 100.';
  var nativeNote = 'Перед счётными словами: 하나→한, 둘→두, 셋→세, 넷→네, 스물→스무.';
  function add(system, value, kind, question, correct, candidates, note){
    items.push({
      question: question,
      options: numberOptions(correct, candidates),
      correct: String(correct),
      note: note || '',
      system: system,
      value: value,
      kind: kind,
      id: 'num' + seq++
    });
  }
  function addSinoFixed(n){
    var reading = sinoNumber(n);
    var readingQuestion = n === 0 ? 'Как обычно читается 0 в корейско-китайской системе при счёте и вычислениях?' : 'Как читается число ' + n + ' по корейско-китайской системе?';
    add('sino', n, 'fixed', readingQuestion, reading, sinoReadingOptions(n), sinoNote);
    add('sino', n, 'fixed', 'Какому числу соответствует «' + reading + '»?', String(n), numericNumberOptions(n), sinoNote);
    if(n < 100){
      add('sino', n, 'fixed', 'Как правильно сказать «' + n + ' минут»?', reading + ' 분', [nativeCounterNumber(n) && nativeCounterNumber(n) + ' 분', sinoNumber(n+1) + ' 분', reading + ' 시', reading + ' 개'], sinoNote);
      if(n === 0) add('sino', n, 'fixed', 'Как правильно сказать «0 градусов»?', '영 도', ['공 도','한 도','일 도'], sinoNote);
      else add('sino', n, 'fixed', 'Как правильно назвать ' + n + '-й этаж?', reading + ' 층', [nativeCounterNumber(n) && nativeCounterNumber(n) + ' 층', sinoNumber(n+1) + ' 층', reading + ' 시', reading + ' 개'], sinoNote);
    } else {
      add('sino', n, 'fixed', 'Как правильно сказать сумму «' + n + ' вон»?', reading + ' 원', [sinoNumber(n+1) + ' 원', reading + ' 개', reading + ' 시', '일' + reading + ' 원'], sinoNote);
      add('sino', n, 'fixed', 'Как правильно сказать «' + n + ' предметов»?', reading + ' 개', [sinoNumber(n+1) + ' 개', reading + ' 원', reading + ' 시', '일' + reading + ' 개'], sinoNote);
    }
  }
  function addNativeZero(){
    add('native', 0, 'fixed', 'Есть ли отдельное исконно-корейское числительное для нуля?', 'Нет, обычно используют 영 или 공', ['Да, это 하나','Да, это 영','Да, это 공'], 'У нуля нет отдельной исконно-корейской формы: обычно используются 영 или 공.');
    add('native', 0, 'fixed', 'Как обычно читают 0 в математике, счёте и температуре?', '영', ['공','하나','일'], '영 — обычное чтение нуля; 공 часто используется в номерах телефонов и кодах.');
    add('native', 0, 'fixed', 'Как обычно читают цифру 0 в номере телефона?', '공', ['영','하나','십'], 'В телефонных номерах и кодах 0 обычно читается 공.');
    add('native', 0, 'fixed', 'Как естественно сказать «нет ни одного предмета»?', '하나도 없어요', ['한 개 있어요','영 개 있어요','공 개 있어요'], 'Для значения «ни одного» естественно используется конструкция 하나도 없다.');
  }
  function addNativeFixed(n){
    if(n === 0){ addNativeZero(); return; }
    var reading = nativeNumber(n);
    var counter = nativeCounterNumber(n);
    add('native', n, 'fixed', 'Как читается число ' + n + ' по исконно-корейской системе?', reading, nativeReadingOptions(n), nativeNote);
    add('native', n, 'fixed', 'Какому числу соответствует «' + reading + '»?', String(n), numericNumberOptions(n), nativeNote);
    add('native', n, 'fixed', 'Как правильно сказать «' + n + ' предметов»?', counter + ' 개', [reading + ' 개', sinoNumber(n) + ' 개', nativeCounterNumber(Math.min(99,n+1)) + ' 개', counter + ' 분'], nativeNote);
    var unit = n <= 12 ? '시' : '명';
    var label = n <= 12 ? '«сейчас ' + n + ' часов»' : '«' + n + ' обычных участников»';
    add('native', n, 'fixed', 'Как правильно сказать ' + label + '?', counter + ' ' + unit, [sinoNumber(n) + ' ' + unit, reading + ' ' + unit, nativeCounterNumber(Math.min(99,n+1)) + ' ' + unit, counter + ' 분'], nativeNote);
  }
  var fixed = [0,1,2,3,4,5,6,7,8,9,10,20,30,40,50,60,70,80,90,100,1000,10000];
  fixed.forEach(addSinoFixed);
  fixed.filter(function(n){ return n < 100; }).forEach(addNativeFixed);

  var under100 = [13,17,24,29,35,42,47,53,68,71,76,84,89,94,99];
  under100.forEach(function(n, i){
    var kind = 'mixed-under-100';
    if(i % 4 === 0) add('sino', n, kind, 'Выберите корейско-китайское чтение числа ' + n + '.', sinoNumber(n), sinoReadingOptions(n), sinoNote);
    else if(i % 4 === 1) add('native', n, kind, 'Выберите исконно-корейское чтение числа ' + n + '.', nativeNumber(n), nativeReadingOptions(n), nativeNote);
    else if(i % 4 === 2) add('native', n, kind, 'Как правильно сказать «' + n + ' предметов»?', nativeCounterNumber(n) + ' 개', [nativeNumber(n) + ' 개', sinoNumber(n) + ' 개', nativeCounterNumber(n+1) && nativeCounterNumber(n+1) + ' 개', nativeCounterNumber(n-1) + ' 개', nativeCounterNumber(n) + ' 분'], nativeNote);
    else add('native', n, kind, 'Как правильно сказать «' + n + ' человек» в обычном счёте?', nativeCounterNumber(n) + ' 명', [sinoNumber(n) + ' 명', nativeNumber(n) + ' 명', nativeCounterNumber(n+1) + ' 명', nativeCounterNumber(n) + ' 분'], nativeNote);
  });

  var under1000 = [101,115,203,248,319,407,512,570,628,684,735,846,909,950,999];
  under1000.forEach(function(n, i){
    var reading = sinoNumber(n);
    if(i % 3 === 0) add('sino', n, 'mixed-under-1000', 'Как читается число ' + n + '?', reading, sinoReadingOptions(n), sinoNote);
    else if(i % 3 === 1) add('sino', n, 'mixed-under-1000', 'Какому числу соответствует «' + reading + '»?', String(n), numericNumberOptions(n), sinoNote);
    else add('sino', n, 'mixed-under-1000', 'Как правильно сказать сумму «' + n + ' вон»?', reading + ' 원', [sinoNumber(n+1) + ' 원', reading + ' 개', reading + ' 시', '일' + reading + ' 원'], sinoNote);
  });

  var over1000 = [1001,1205,2347,5008,7340,9999,10001,12040,25890,47013,50008,68421,75090,90999,99999];
  over1000.forEach(function(n, i){
    var reading = sinoNumber(n);
    if(i % 3 === 0) add('sino', n, 'mixed-over-1000', 'Как читается число ' + n + '?', reading, sinoReadingOptions(n), sinoNote);
    else if(i % 3 === 1) add('sino', n, 'mixed-over-1000', 'Какому числу соответствует «' + reading + '»?', String(n), numericNumberOptions(n), sinoNote);
    else add('sino', n, 'mixed-over-1000', 'Как правильно сказать сумму «' + n + ' вон»?', reading + ' 원', [sinoNumber(n+1) + ' 원', reading + ' 개', reading + ' 시', '일' + reading + ' 원'], sinoNote);
  });
  return items;
}
function qThemeType(item){ return {type:'countertype', item: item}; }
function qThemeTranslate(item){ return {type:'countertranslate', item: item}; }
var MIXED_THEME_FACTORIES = [qThemeCloze, qThemeType, qThemeTranslate];
function qThemeMixed(item){
  var factory = MIXED_THEME_FACTORIES[Math.floor(Math.random()*MIXED_THEME_FACTORIES.length)];
  return factory(item);
}
function qAntSyn(word){
  var rel = word.related;
  if(!rel) return null;
  var target = null;
  for(var i=0;i<ALL_WORDS.length;i++){ if(ALL_WORDS[i].kr === rel.target){ target = ALL_WORDS[i]; break; } }
  if(!target) return null;
  var pool = ALL_WORDS.filter(function(w){ return w.id !== word.id && w.kr !== target.kr; });
  var opts = shuffle([target].concat(sample(pool, 4)));
  return {type:'antsyn', word:word, relType: rel.type, target: target, options: opts};
}

/* ============ PERSISTENCE ============ */
var STORAGE_KEY = 'progress-v2';
var state;
function initState(){
  state = {
    loaded: false,
    progress: {},
    excluded: {},
    view: 'session', // 'session' | 'words' | 'grammar'
    wordsCatOpen: false,
    wordsSelected: CATEGORIES.slice(),
    wordsMode: 'cards',
    wordsModeOpen: false,
    phrasesCatOpen: false,
    phrasesSelected: PHRASE_CATEGORIES.slice(),
    phrasesMode: 'cards',
    phrasesModeOpen: false,
    excludedPanelOpen: false,
    excludedPhPanelOpen: false,
    grammarCatOpen: false,
    grammarSelected: GRAMMAR_CATS.slice(),
    grammarSub: 'reference', // 'reference' | 'practice' | 'cards'
    grammarRefView: 'topic', // 'topic' | 'lesson' (только для «Справочник»)
    grammarExpanded: {}, // pattern -> true, раскрытые карточки в справочнике
    grammarTopicOpen: {}, // category -> true, раскрытые темы в справочнике
    grammarLessonOpen: {}, // lesson number -> true, раскрытые уроки в справочнике
    grammarCardMode: 'flip', // 'flip' | 'type' (только для «Карточки»)
    examSub: 'reading', // 'reading' | 'ordering' | 'construct' | 'cloze'
    examSubOpen: false,
    qaSub: 'qword', // 'qword' | 'qanswer' | 'response'
    qaSubOpen: false,
    themeSub: 'counters', // 'counters' | 'numbers' | 'datetime' | 'honorific' | 'position'
    themeCounterMode: 'choice', // 'choice' | 'type' | 'translate' (только для счётных слов)
    themeSubOpen: false,
    searchQuery: '',
    aiPanelOpen: false,
    aiInput: '',
    aiLoading: false,
    aiSaving: false,
    aiError: '',
    aiPreview: null, // {kr, translit, meaning, notes, examples}
    session: { phase: 'setup', size: 10, stageIdx: 0, stages: [], wordSet: [], results: {},
      mode: 'category', // 'lesson' | 'category'
      orderMode: 'sequential', // 'sequential' | 'mixed'
      phases: [], phaseIdx: 0, mq: {items:[], idx:0}, statsList: [], lastCorrect: null,
      lessonSelected: [1], lessonOpen: false,
      catSelected: CATEGORIES.slice(), catOpen: false },
    mockExam: { phase: 'pick', examKey: null, queue: [], index: 0,
      listeningCorrect: 0, listeningTotal: 0, readingCorrect: 0, readingTotal: 0 },
    retry: { steps: {}, pending: {}, active: {} },
    player: { queue: [], index: 0, mockcurrent: null },
    ui: {} // ephemeral per-question ui state (flipped, chosen, typedValue, typedResult)
  };
}

var RETRY_SPACING = 5;
function clearRetryContext(context){
  if(!state.retry) state.retry = {steps:{}, pending:{}, active:{}};
  state.retry.steps[context] = 0;
  state.retry.pending[context] = [];
  delete state.retry.active[context];
}
function retryQuestionKey(q){
  if(q.word) return q.type + ':word:' + (q.word.id || q.word.kr);
  if(q.ex) return q.type + ':exercise:' + (q.ex.id || q.ex.pattern);
  if(q.item) return q.type + ':item:' + (q.item.id || q.item.pattern || q.item.correct);
  return q.type;
}
function retryContextForState(){
  if(state.view === 'session') return state.session.orderMode === 'mixed' ? null : 'session';
  if(state.view === 'grammar' && state.grammarSub === 'practice') return 'grammar';
  if(state.view === 'grammar' && state.grammarSub === 'cards') return 'gramcards';
  if(state.view === 'qa') return 'qa';
  if(state.view === 'theme') return 'theme';
  if(state.view === 'words') return 'words';
  if(state.view === 'phrases') return 'phrases';
  return null;
}
function recordPracticeAnswer(q, isCorrect){
  var context = retryContextForState();
  if(!context || !q) return;
  var key = retryQuestionKey(q);
  var pending = state.retry.pending[context] || (state.retry.pending[context] = []);
  if(isCorrect){
    state.retry.pending[context] = pending.filter(function(entry){ return entry.key !== key; });
    return;
  }
  var due = (state.retry.steps[context] || 0) + RETRY_SPACING + 1;
  var existing = pending.filter(function(entry){ return entry.key === key; })[0];
  if(existing){ existing.due = Math.min(existing.due, due); }
  else pending.push({key:key, due:due, question:q});
}
function takeDueRetry(context){
  var active = state.retry.active[context];
  if(active) return active.question;
  var pending = state.retry.pending[context] || [];
  var step = state.retry.steps[context] || 0;
  var index = -1;
  for(var i=0;i<pending.length;i++){
    if(pending[i].due <= step){ index = i; break; }
  }
  if(index === -1) return null;
  active = pending.splice(index, 1)[0];
  state.retry.active[context] = active;
  return active.question;
}
function finishRetryTurn(context){
  var wasRetry = !!state.retry.active[context];
  delete state.retry.active[context];
  state.retry.steps[context] = (state.retry.steps[context] || 0) + 1;
  return wasRetry;
}
function hasPendingRetries(context){ return !!((state.retry.pending[context] || []).length); }
function makeRetriesDue(context){
  var step = state.retry.steps[context] || 0;
  (state.retry.pending[context] || []).forEach(function(entry){ entry.due = step; });
}
function cancelRetriesForWord(id){
  ['words','phrases','session'].forEach(function(context){
    state.retry.pending[context] = (state.retry.pending[context] || []).filter(function(entry){
      return !(entry.question.word && entry.question.word.id === id);
    });
    var active = state.retry.active[context];
    if(active && active.question.word && active.question.word.id === id) delete state.retry.active[context];
  });
}

var EXCLUDED_KEY = 'excluded-v1';
function loadExcluded(){
  try{
    var raw = localStorage.getItem(EXCLUDED_KEY);
    if(raw) state.excluded = JSON.parse(raw);
  }catch(e){}
}
function saveExcluded(){ try{ localStorage.setItem(EXCLUDED_KEY, JSON.stringify(state.excluded)); }catch(e){} }
function excludeWord(id){ state.excluded[id] = true; saveExcluded(); purgeExcludedFromLiveQueues(id); }
function restoreWord(id){ delete state.excluded[id]; saveExcluded(); }
/* убрать слово из уже построенных очередей сессии/раздела «Слова», чтобы оно не всплыло позже в том же проходе */
function purgeExcludedFromLiveQueues(id){
  cancelRetriesForWord(id);
  function isMatch(q){ return q && q.word && q.word.id === id; }
  if(state.player.words && state.player.words.length){
    var removedBefore = 0;
    var filteredWords = [];
    state.player.words.forEach(function(w, i){
      if(w.id === id){ if(i <= state.player.index) removedBefore++; }
      else filteredWords.push(w);
    });
    state.player.words = filteredWords;
    state.player.index = filteredWords.length ? Math.max(0, state.player.index - removedBefore) : 0;
  }
  if(state.player.phwords && state.player.phwords.length){
    var removedBeforePh = 0;
    var filteredPh = [];
    state.player.phwords.forEach(function(w, i){
      if(w.id === id){ if(i <= state.player.phindex) removedBeforePh++; }
      else filteredPh.push(w);
    });
    state.player.phwords = filteredPh;
    state.player.phindex = filteredPh.length ? Math.max(0, state.player.phindex - removedBeforePh) : 0;
  }
  if(state.session.stages && state.session.stages.length){
    state.session.stages.forEach(function(st){
      var removedBefore = 0;
      var filteredQueue = [];
      st.queue.forEach(function(q, i){
        if(isMatch(q)){ if(i <= st.index) removedBefore++; }
        else filteredQueue.push(q);
      });
      st.queue = filteredQueue;
      st.index = filteredQueue.length ? Math.max(0, Math.min(st.index - removedBefore, filteredQueue.length - 1)) : 0;
    });
  }
  if(state.session.mq && state.session.mq.items && state.session.mq.items.length){
    var mq = state.session.mq;
    var removedBeforeMq = 0;
    var filteredMq = [];
    mq.items.forEach(function(item, i){
      if(isMatch(item.q)){ if(i <= mq.idx) removedBeforeMq++; }
      else filteredMq.push(item);
    });
    mq.items = filteredMq;
    mq.idx = filteredMq.length ? Math.max(0, Math.min(mq.idx - removedBeforeMq, filteredMq.length - 1)) : 0;
  }
  if(state.session.phases && state.session.phases.length){
    state.session.phases.forEach(function(ph){
      ph.items = ph.items.filter(function(item){ return !isMatch(item.q); });
    });
  }
}

function loadProgress(){
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(raw) state.progress = JSON.parse(raw);
  }catch(e){}
  loadExcluded();
  state.loaded = true;
  resetWordsQueue();
  resetGrammarQueue();
  resetExamQueue();
  resetQAQueue();
  resetThemeQueue();
  resetPhrasesQueue();
  render();
}
function saveProgress(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); }catch(e){} }
function markWord(id, status){ state.progress[id] = status; saveProgress(); }
function statsOverall(){
  var known=0, learning=0;
  Object.keys(state.progress).forEach(function(k){
    if(state.progress[k]==='known') known++; else if(state.progress[k]==='learning') learning++;
  });
  return {total: ALL_WORDS.length, known: known, learning: learning};
}

/* ============ WORDS STANDALONE QUEUE ============ */
function resetWordsQueue(){
  clearRetryContext('words');
  var filtered = ALL_WORDS.filter(function(w){ return state.wordsSelected.indexOf(w.category) !== -1 && !state.excluded[w.id]; });
  var pool = orderWithPairsAdjacent(shuffle(filtered));
  state.player.words = pool;
  state.player.index = 0;
  state.ui = {};
  rebuildStandaloneQuestion();
}
function rebuildStandaloneQuestion(){
  var pool = state.player.words || [];
  if(!pool.length){ state.player.current = null; return; }
  var retry = takeDueRetry('words');
  if(retry){ state.player.current = retry; state.ui = {}; return; }
  var tries = 0, q = null;
  while(tries < pool.length){
    var w = pool[state.player.index % pool.length];
    if(state.wordsMode === 'cards') q = qCard(w);
    else if(state.wordsMode === 'kr2ru') q = qKr2Ru(w);
    else if(state.wordsMode === 'ru2kr') q = qRu2Kr(w);
    else if(state.wordsMode === 'sentchoice') q = qSentChoice(w);
    else if(state.wordsMode === 'spell') q = qSpell(w);
    else if(state.wordsMode === 'senttype') q = qSentType(w);
    else if(state.wordsMode === 'antsyn') q = qAntSyn(w);
    if(q){ break; }
    state.player.index++; tries++;
  }
  state.player.current = q;
  state.ui = {};
}
function advanceStandalone(){
  if(!finishRetryTurn('words')) state.player.index = (state.player.index + 1) % (state.player.words.length || 1);
  rebuildStandaloneQuestion();
}

/* ============ PHRASES STANDALONE QUEUE ============ */
function resetPhrasesQueue(){
  clearRetryContext('phrases');
  var filtered = ALL_PHRASES.filter(function(p){ return state.phrasesSelected.indexOf(p.category) !== -1 && !state.excluded[p.id]; });
  state.player.phwords = shuffle(filtered);
  state.player.phindex = 0;
  state.ui = {};
  rebuildPhrasesQuestion();
}
function rebuildPhrasesQuestion(){
  var pool = state.player.phwords || [];
  if(!pool.length){ state.player.phcurrent = null; return; }
  var retry = takeDueRetry('phrases');
  if(retry){ state.player.phcurrent = retry; state.ui = {}; return; }
  var p = pool[state.player.phindex % pool.length];
  var q;
  if(state.phrasesMode === 'cards') q = qCard(p);
  else if(state.phrasesMode === 'kr2ru') q = qKr2Ru(p, ALL_PHRASES);
  else if(state.phrasesMode === 'ru2kr') q = qRu2Kr(p, ALL_PHRASES);
  state.player.phcurrent = q;
  state.ui = {};
}
function advancePhrasesStandalone(){
  if(!finishRetryTurn('phrases')) state.player.phindex = (state.player.phindex + 1) % (state.player.phwords.length || 1);
  rebuildPhrasesQuestion();
}

/* ============ GRAMMAR STANDALONE QUEUE ============ */
function resetGrammarQueue(){
  clearRetryContext('grammar');
  var filtered = GRAMMAR_EXERCISES.filter(function(e){ return state.grammarSelected.indexOf(exCatFull(e)) !== -1; });
  var pool = buildPerAnswerSample(filtered, 5, function(e){ return e.pattern; });
  state.player.gwords = pool;
  state.player.gindex = 0;
  rebuildGrammarQuestion();
}
function rebuildGrammarQuestion(){
  var pool = state.player.gwords || [];
  var retry = takeDueRetry('grammar');
  state.player.gcurrent = retry || (pool.length ? qGrammar(pool[state.player.gindex % pool.length]) : null);
  state.ui = {};
}
function advanceGrammar(){
  if(!finishRetryTurn('grammar')) state.player.gindex = (state.player.gindex + 1) % (state.player.gwords.length || 1);
  rebuildGrammarQuestion();
}
function resetGrammarCardsQueue(){
  clearRetryContext('gramcards');
  var items = [];
  GRAMMAR_TOPICS.forEach(function(t){
    if(state.grammarSelected.indexOf(t.category) !== -1) items = items.concat(t.items);
  });
  state.player.gcwords = shuffle(items);
  state.player.gcindex = 0;
  rebuildGrammarCardsQuestion();
}
function rebuildGrammarCardsQuestion(){
  var pool = state.player.gcwords || [];
  var factory = state.grammarCardMode === 'type' ? qGrammarSpell : qGrammarCard;
  var retry = takeDueRetry('gramcards');
  state.player.gccurrent = retry || (pool.length ? factory(pool[state.player.gcindex % pool.length]) : null);
  state.ui = {};
}
function advanceGrammarCards(){
  if(!finishRetryTurn('gramcards')) state.player.gcindex = (state.player.gcindex + 1) % (state.player.gcwords.length || 1);
  rebuildGrammarCardsQuestion();
}

/* ============ EXAM STANDALONE QUEUE ============ */
var EXAM_FACTORY = { reading: qExamReading, ordering: qExamOrdering, construct: qExamConstruct, cloze: qExamCloze, listening: qExamListening, topikReading: qExamTopikReading };
function resetExamQueue(){
  var pool = shuffle((EXAM_DATA[state.examSub] || []).slice());
  state.player.exwords = pool;
  state.player.exindex = 0;
  rebuildExamQuestion();
}
function rebuildExamQuestion(){
  var pool = state.player.exwords || [];
  var factory = EXAM_FACTORY[state.examSub];
  state.player.excurrent = pool.length ? factory(pool[state.player.exindex % pool.length]) : null;
  state.ui = {};
}
function advanceExam(){
  state.player.exindex = (state.player.exindex + 1) % (state.player.exwords.length || 1);
  rebuildExamQuestion();
}

function mockQuestionNumber(id, part){
  var match = id.match(new RegExp('-' + part + '(\\d+)$'));
  return match ? parseInt(match[1], 10) : 0;
}
function listMockExams(){
  var seen = {};
  (EXAM_DATA.topikReading || []).forEach(function(item){
    var idMatch = item.id.match(/^t(\d+)-/);
    if(!idMatch) return;
    var key = 't' + idMatch[1];
    if(seen[key]) return;
    var sourceMatch = (item.source || '').match(/제(\d+)회/);
    seen[key] = sourceMatch ? parseInt(sourceMatch[1], 10) : parseInt(idMatch[1], 10);
  });
  return Object.keys(seen).map(function(key){
    return {
      key: key,
      num: seen[key],
      listeningCount: (EXAM_DATA.listening || []).filter(function(item){ return item.id.indexOf(key + '-l') === 0; }).length,
      readingCount: (EXAM_DATA.topikReading || []).filter(function(item){ return item.id.indexOf(key + '-r') === 0; }).length
    };
  }).sort(function(a, b){ return b.num - a.num; });
}
function startMockExam(key){
  var listeningPart = (EXAM_DATA.listening || []).filter(function(item){
    return item.id.indexOf(key + '-l') === 0;
  }).sort(function(a, b){
    return mockQuestionNumber(a.id, 'l') - mockQuestionNumber(b.id, 'l');
  }).map(function(item){
    return {kind:'exlisten', item:item, num:mockQuestionNumber(item.id, 'l')};
  });
  var readingPart = (EXAM_DATA.topikReading || []).filter(function(item){
    return item.id.indexOf(key + '-r') === 0;
  }).sort(function(a, b){
    return mockQuestionNumber(a.id, 'r') - mockQuestionNumber(b.id, 'r');
  }).map(function(item){
    return {kind:'extopikread', item:item, num:mockQuestionNumber(item.id, 'r')};
  });
  state.mockExam = { phase:'running', examKey:key, queue:listeningPart.concat(readingPart), index:0,
    listeningCorrect:0, listeningTotal:0, readingCorrect:0, readingTotal:0 };
  rebuildMockQuestion();
}
function rebuildMockQuestion(){
  var entry = state.mockExam.queue[state.mockExam.index];
  state.player.mockcurrent = entry ? (entry.kind === 'exlisten' ? qExamListening(entry.item) : qExamTopikReading(entry.item)) : null;
  state.ui = {};
}
function mockAnswered(isCorrect){
  var entry = state.mockExam.queue[state.mockExam.index];
  if(!entry) return;
  if(entry.kind === 'exlisten'){
    state.mockExam.listeningTotal++;
    if(isCorrect) state.mockExam.listeningCorrect++;
  } else {
    state.mockExam.readingTotal++;
    if(isCorrect) state.mockExam.readingCorrect++;
  }
}
function advanceMock(){
  state.mockExam.index++;
  if(state.mockExam.index >= state.mockExam.queue.length) state.mockExam.phase = 'done';
  else rebuildMockQuestion();
}

/* ============ QA STANDALONE QUEUE ============ */
var QA_FACTORY = { qword: qQWord, qanswer: qQAnswer, response: qResponse };
function resetQAQueue(){
  clearRetryContext('qa');
  var pool = shuffle((QA_DATA[state.qaSub] || []).slice());
  state.player.qawords = pool;
  state.player.qaindex = 0;
  rebuildQAQuestion();
}
function rebuildQAQuestion(){
  var pool = state.player.qawords || [];
  var factory = QA_FACTORY[state.qaSub];
  var retry = takeDueRetry('qa');
  state.player.qacurrent = retry || (pool.length ? factory(pool[state.player.qaindex % pool.length]) : null);
  state.ui = {};
}
function advanceQA(){
  if(!finishRetryTurn('qa')) state.player.qaindex = (state.player.qaindex + 1) % (state.player.qawords.length || 1);
  rebuildQAQuestion();
}

/* ============ THEME STANDALONE QUEUE ============ */
var THEME_FACTORY = { counters: qThemeCloze, numbers: qThemeDate, honorific: qThemeCloze, position: qThemeCloze, datetime: qThemeDate, irregular: qThemeCloze };
var THEME_MODE_SECTIONS = ['counters','position','irregular']; // разделы с режимами Выбор/Впишите/Переведите/Смешанный
function themeGroupKey(item){ return item.word || item.correct; }
function buildPerAnswerSample(items, perAnswer, groupKeyFn){
  var keyFn = groupKeyFn || function(item){ return item.correct; };
  var groups = {};
  items.forEach(function(item){
    var key = keyFn(item);
    (groups[key] = groups[key] || []).push(item);
  });
  var selected = [];
  Object.keys(groups).forEach(function(key){
    selected = selected.concat(sample(groups[key], Math.min(perAnswer, groups[key].length)));
  });
  return shuffle(selected);
}
/* если в выборку попало слово из antonym/synonym-пары (item.pairId), а его пара — нет, добираем её */
function ensurePairedItems(allItems, selected, groupKeyFn){
  var keyFn = groupKeyFn || function(item){ return item.correct; };
  var itemsByGroupKey = {};
  var groupKeysByPair = {};
  allItems.forEach(function(item){
    var gk = keyFn(item);
    (itemsByGroupKey[gk] = itemsByGroupKey[gk] || []).push(item);
    if(item.pairId){ (groupKeysByPair[item.pairId] = groupKeysByPair[item.pairId] || {})[gk] = true; }
  });
  var haveGroupKeys = {};
  selected.forEach(function(item){ haveGroupKeys[keyFn(item)] = true; });
  var result = selected.slice();
  Object.keys(groupKeysByPair).forEach(function(pid){
    var groupKeys = Object.keys(groupKeysByPair[pid]);
    var anyPresent = groupKeys.some(function(gk){ return haveGroupKeys[gk]; });
    if(!anyPresent) return;
    groupKeys.forEach(function(gk){
      if(haveGroupKeys[gk]) return;
      var candidates = itemsByGroupKey[gk] || [];
      if(candidates.length){ result.push(sample(candidates, 1)[0]); haveGroupKeys[gk] = true; }
    });
  });
  return shuffle(result);
}
function resetThemeQueue(){
  clearRetryContext('theme');
  var basePool = (THEME_DATA[state.themeSub] || []).slice();
  var pool;
  if(THEME_MODE_SECTIONS.indexOf(state.themeSub) !== -1){
    var groupKeyFn = state.themeSub === 'irregular' ? themeGroupKey : function(item){ return item.correct; };
    pool = ensurePairedItems(basePool, buildPerAnswerSample(basePool, 2, groupKeyFn), groupKeyFn);
  } else {
    pool = shuffle(basePool);
  }
  state.player.thwords = pool;
  state.player.thindex = 0;
  rebuildThemeQuestion();
}
function rebuildThemeQuestion(){
  var pool = state.player.thwords || [];
  var factory;
  if(THEME_MODE_SECTIONS.indexOf(state.themeSub) !== -1){
    factory = state.themeCounterMode === 'type' ? qThemeType
      : state.themeCounterMode === 'translate' ? qThemeTranslate
      : state.themeCounterMode === 'mixed' ? qThemeMixed
      : qThemeCloze;
  } else {
    factory = THEME_FACTORY[state.themeSub];
  }
  var retry = takeDueRetry('theme');
  state.player.thcurrent = retry || (pool.length ? factory(pool[state.player.thindex % pool.length]) : null);
  state.ui = {};
}
function advanceTheme(){
  if(!finishRetryTurn('theme')) state.player.thindex = (state.player.thindex + 1) % (state.player.thwords.length || 1);
  rebuildThemeQuestion();
}

/* ============ SESSION ============ */
var STAGE_DEFS = [
  {key:'cards', label:'Карточки', build: function(words){ return words.map(qCard); }},
  {key:'kr2ru', label:'Слово → перевод', build: function(words){ return words.map(qKr2Ru); }},
  {key:'ru2kr', label:'Перевод → слово', build: function(words){ return words.map(qRu2Kr); }},
  {key:'sentchoice', label:'Предложение: выбор слова', build: function(words){ return words.map(qSentChoice).filter(Boolean); }},
  {key:'spell', label:'Написание', build: function(words){ return words.map(qSpell); }},
  {key:'senttype', label:'Предложение: впишите слово', build: function(words){ return words.map(qSentType).filter(Boolean); }},
  {key:'antsyn', label:'Антонимы и синонимы', build: function(words){ return words.map(qAntSyn).filter(Boolean); }},
  {key:'grammar', label:'Грамматика', build: function(words, eligibleGrammar){ var pool = eligibleGrammar || GRAMMAR_EXERCISES; return sample(pool, Math.min(5, pool.length)).map(qGrammar); }}
];

var STAGE_LABELS = {
  cards:'Карточки', kr2ru:'Слово → перевод', ru2kr:'Перевод → слово', sentchoice:'Предложение: выбор слова',
  spell:'Написание', senttype:'Предложение: впишите слово', antsyn:'Антонимы и синонимы', grammar:'Грамматика'
};
var STAGE_ORDER = ['cards','kr2ru','ru2kr','sentchoice','spell','senttype','antsyn','grammar'];
function stageKeyForType(t){ return t === 'card' ? 'cards' : t; }

function buildAdaptivePhases(wordSet, eligibleGrammar){
  var batchSize = 10;
  var batches = [];
  for(var i=0;i<wordSet.length;i+=batchSize){ batches.push(wordSet.slice(i, i+batchSize)); }
  var phases = [];
  var cumulative = [];
  batches.forEach(function(batch, i){
    var phaseWords = orderWithPairsAdjacent(shuffle(cumulative.concat(batch)));
    var items = phaseWords.map(function(w){ return {q: qCard(w)}; });
    phases.push({
      type: 'cards',
      label: 'Карточки ' + (i+1) + '/' + batches.length + (cumulative.length ? ' (+ повтор ' + cumulative.length + ')' : ''),
      items: items
    });
    cumulative = cumulative.concat(batch);
  });
  var finalItems = [];
  wordSet.forEach(function(w){
    finalItems.push({q: qKr2Ru(w)});
    finalItems.push({q: qRu2Kr(w)});
    var sc = qSentChoice(w); if(sc) finalItems.push({q: sc});
    finalItems.push({q: qSpell(w)});
    var stq = qSentType(w); if(stq) finalItems.push({q: stq});
    var asq = qAntSyn(w); if(asq) finalItems.push({q: asq});
  });
  sample(eligibleGrammar, Math.min(5, eligibleGrammar.length)).forEach(function(ex){
    finalItems.push({q: qGrammar(ex)});
  });
  phases.push({ type:'final', label:'Смешанная практика — до идеала', items: orderQuestionsWithPairsAdjacent(shuffle(finalItems)) });
  return phases;
}
function computeStatsList(phases){
  var present = {};
  phases.forEach(function(ph){ ph.items.forEach(function(it){ present[stageKeyForType(it.q.type)] = true; }); });
  return STAGE_ORDER.filter(function(k){ return present[k]; }).map(function(k){ return {key:k, label:STAGE_LABELS[k], correct:0, total:0}; });
}

function startSession(){
  clearRetryContext('session');
  var allowedCategories = state.session.mode === 'lesson' ? categoriesForLessons(state.session.lessonSelected) : state.session.catSelected;
  var categoryPool = ALL_WORDS.filter(function(w){ return allowedCategories.indexOf(w.category) !== -1 && !state.excluded[w.id]; });
  var pool = shuffle(categoryPool);
  var wordSet = orderWithPairsAdjacent(expandWithPairs(pool.slice(0, state.session.size), categoryPool));
  state.session.wordSet = wordSet;
  var eligibleGrammar = state.session.mode === 'lesson'
    ? GRAMMAR_EXERCISES.filter(function(e){ return e.lesson.some(function(l){ return state.session.lessonSelected.indexOf(l) !== -1; }); })
    : GRAMMAR_EXERCISES;

  if(state.session.orderMode === 'mixed'){
    if(wordSet.length === 0){ state.session.emptyWarning = true; render(); return; }
    var phases = buildAdaptivePhases(wordSet, eligibleGrammar);
    state.session.emptyWarning = false;
    state.session.phases = phases;
    state.session.phaseIdx = 0;
    state.session.mq = { items: phases[0].items.slice(), idx: 0 };
    state.session.statsList = computeStatsList(phases);
    state.session.phase = 'running';
    state.ui = {};
    render();
    return;
  }

  var stages = STAGE_DEFS.map(function(sd){ return {key: sd.key, label: sd.label, queue: sd.build(wordSet, eligibleGrammar), index:0, correct:0, total:0}; })
    .filter(function(st){ return st.queue.length > 0; });
  if(stages.length === 0){
    state.session.emptyWarning = true;
    render();
    return;
  }
  state.session.emptyWarning = false;
  state.session.stages = stages;
  state.session.statsList = stages;
  state.session.stageIdx = 0;
  state.session.phase = 'running';
  state.ui = {};
  render();
}
function currentStage(){ return state.session.stages[state.session.stageIdx]; }
function currentMQItem(){
  var mq = state.session.mq;
  if(!mq || !mq.items.length) return null;
  return mq.items[mq.idx % mq.items.length];
}
function currentSessionQuestion(){
  if(state.session.orderMode === 'mixed'){
    var item = currentMQItem();
    return item ? item.q : null;
  }
  var retry = takeDueRetry('session');
  if(retry) return retry;
  var st = currentStage();
  if(!st) return null;
  return st.queue[st.index];
}
function sessionAnswered(isCorrect){
  state.session.lastCorrect = isCorrect;
  if(state.session.orderMode === 'mixed'){
    var item = currentMQItem();
    if(!item) return;
    var key = stageKeyForType(item.q.type);
    var stat = state.session.statsList.filter(function(s){ return s.key === key; })[0];
    if(stat){ stat.total++; if(isCorrect) stat.correct++; }
    return;
  }
  var st = currentStage();
  st.total++;
  if(isCorrect) st.correct++;
}
function advanceSession(){
  if(state.session.orderMode === 'mixed'){
    var mq = state.session.mq;
    state.ui = {};
    if(mq && mq.items.length){
      if(state.session.lastCorrect){
        mq.items.splice(mq.idx, 1);
      } else {
        var it = mq.items.splice(mq.idx, 1)[0];
        mq.items.push(it);
      }
    }
    if(!mq.items.length){
      state.session.phaseIdx++;
      if(state.session.phaseIdx >= state.session.phases.length){
        state.session.phase = 'done';
      } else {
        var nextPhase = state.session.phases[state.session.phaseIdx];
        state.session.mq = { items: nextPhase.items.slice(), idx: 0 };
      }
    } else {
      mq.idx = mq.idx % mq.items.length;
    }
    render();
    return;
  }
  var st = currentStage();
  if(!finishRetryTurn('session')) st.index++;
  state.ui = {};
  if(st.index >= st.queue.length){
    if(hasPendingRetries('session')){
      makeRetriesDue('session');
    } else {
      state.session.stageIdx++;
      clearRetryContext('session');
      if(state.session.stageIdx >= state.session.stages.length){
        state.session.phase = 'done';
      }
    }
  }
  render();
}
function restartSessionSetup(){
  clearRetryContext('session');
  state.session.phase = 'setup';
  render();
}

/* ============ GENERIC ANSWER HANDLERS ============ */
// context: 'standalone-words' | 'standalone-grammar' | 'session'
function getActiveQuestion(){
  if(state.view === 'session') return currentSessionQuestion();
  if(state.view === 'grammar' && state.grammarSub === 'practice') return state.player.gcurrent;
  if(state.view === 'grammar' && state.grammarSub === 'cards') return state.player.gccurrent;
  if(state.view === 'exam') return state.player.excurrent;
  if(state.view === 'mockexam') return state.player.mockcurrent;
  if(state.view === 'qa') return state.player.qacurrent;
  if(state.view === 'theme') return state.player.thcurrent;
  if(state.view === 'words') return state.player.current;
  if(state.view === 'phrases') return state.player.phcurrent;
  return null;
}
function goNextAfterAnswer(){
  if(state.view === 'session') advanceSession();
  else if(state.view === 'grammar' && state.grammarSub === 'cards') { advanceGrammarCards(); render(); }
  else if(state.view === 'grammar') { advanceGrammar(); render(); }
  else if(state.view === 'exam') { advanceExam(); render(); }
  else if(state.view === 'mockexam') { advanceMock(); render(); }
  else if(state.view === 'qa') { advanceQA(); render(); }
  else if(state.view === 'theme') { advanceTheme(); render(); }
  else if(state.view === 'phrases') { advancePhrasesStandalone(); render(); }
  else { advanceStandalone(); render(); }
}
function handleCardRate(status){
  var q = getActiveQuestion();
  if(!q || q.type !== 'card') return;
  markWord(q.word.id, status);
  var isCorrect = status === 'known';
  if(state.view === 'session') sessionAnswered(isCorrect);
  recordPracticeAnswer(q, isCorrect);
  goNextAfterAnswer();
}
function handleGrammarCardRate(isCorrect){
  var q = getActiveQuestion();
  if(!q || q.type !== 'gramcard') return;
  recordPracticeAnswer(q, isCorrect);
  goNextAfterAnswer();
}
function handleFlip(){ state.ui.flipped = !state.ui.flipped; render(); }
function handleExcludeWord(){
  var q = getActiveQuestion();
  if(!q || q.type !== 'card') return;
  excludeWord(q.word.id);
  state.ui = {};
  if(state.view === 'words') rebuildStandaloneQuestion();
  else if(state.view === 'phrases') rebuildPhrasesQuestion();
  render();
}
function handleChoice(optValue){
  var q = getActiveQuestion();
  if(!q || state.ui.chosen) return;
  state.ui.chosen = optValue;
  var isCorrect = false;
  if(q.type === 'kr2ru') isCorrect = (optValue === q.word.meaning);
  else if(q.type === 'ru2kr') isCorrect = (optValue === q.word.kr);
  else if(q.type === 'sentchoice') isCorrect = (optValue === q.word.kr);
  else if(q.type === 'antsyn') isCorrect = (optValue === q.target.kr);
  else if(q.type === 'grammar') isCorrect = (optValue === q.ex.correct);
  else if(q.type === 'exread') isCorrect = (optValue === q.item.correct);
  else if(q.type === 'exlisten') isCorrect = (optValue === q.item.correct);
  else if(q.type === 'extopikread') isCorrect = (optValue === q.item.correct);
  else if(q.type === 'exorder') isCorrect = (optValue === q.correctLabel);
  else if(q.type === 'excloze') isCorrect = (optValue === q.item.correct);
  else if(q.type === 'qword') isCorrect = (optValue === q.item.correct);
  else if(q.type === 'qanswer') isCorrect = (optValue === q.item.correct);
  else if(q.type === 'response') isCorrect = (optValue === q.item.correct);
  else if(q.type === 'themecloze') isCorrect = (optValue === q.item.correct);
  else if(q.type === 'themedate') isCorrect = (optValue === q.item.correct);
  if(q.type !== 'grammar' && q.type !== 'exread' && q.type !== 'exlisten' && q.type !== 'extopikread' &&
     q.type !== 'exorder' && q.type !== 'excloze' &&
     q.type !== 'qword' && q.type !== 'qanswer' && q.type !== 'response' &&
     q.type !== 'themecloze' && q.type !== 'themedate') markWord(q.word.id, isCorrect ? 'known' : 'learning');
  if(state.view === 'session') sessionAnswered(isCorrect);
  if(state.view === 'mockexam') mockAnswered(isCorrect);
  recordPracticeAnswer(q, isCorrect);
  render();
  setTimeout(function(){ goNextAfterAnswer(); }, isCorrect ? 500 : 1200);
}
function handleTypeSubmit(value){
  var q = getActiveQuestion();
  if(!q) return;
  if(state.ui.typedResult){ goNextAfterAnswer(); return; }
  var correct;
  if(q.type === 'spell') correct = q.word.kr;
  else if(q.type === 'countertype') correct = q.item.correct;
  else if(q.type === 'countertranslate') correct = (q.item.before + q.item.correct + q.item.after).trim();
  else if(q.type === 'gramspell') correct = q.item.pattern;
  else correct = q.blank.matched;
  var isCorrect = value.trim() === correct;
  state.ui.typedValue = value;
  state.ui.typedResult = isCorrect ? 'ok' : 'bad';
  if(q.word) markWord(q.word.id, isCorrect ? 'known' : 'learning');
  if(state.view === 'session') sessionAnswered(isCorrect);
  recordPracticeAnswer(q, isCorrect);
  render();
}
function handleConstructTap(key){
  var q = getActiveQuestion();
  if(!q || q.type !== 'excon' || state.ui.constructResult) return;
  state.ui.constructPicked = state.ui.constructPicked || [];
  state.ui.constructPicked.push(key);
  render();
}
function handleConstructRemove(idx){
  var q = getActiveQuestion();
  if(!q || q.type !== 'excon' || state.ui.constructResult) return;
  state.ui.constructPicked = state.ui.constructPicked || [];
  state.ui.constructPicked.splice(idx, 1);
  render();
}
function handleConstructSubmit(){
  var q = getActiveQuestion();
  if(!q || q.type !== 'excon') return;
  if(state.ui.constructResult){ goNextAfterAnswer(); return; }
  var picked = state.ui.constructPicked || [];
  var text = picked.map(function(key){
    var w = q.shuffled.find(function(x){ return x.key === key; });
    return w ? w.text : '';
  }).join(' ');
  var isCorrect = text === q.item.correct;
  state.ui.constructResult = isCorrect ? 'ok' : 'bad';
  if(state.view === 'session') sessionAnswered(isCorrect);
  render();
}
function handleConstructClear(){
  state.ui.constructPicked = [];
  render();
}

/* ============ RENDER: QUESTION TYPES ============ */
function renderCard(q){
  var word = q.word;
  var backContent = '';
  if(word.examples && word.examples.length){
    backContent = '<div class="notes"><b>Пример:</b> ' + esc(word.examples[0].kr) + ' — ' + esc(word.examples[0].ru) + '</div>';
  } else {
    var examples = extractExamples(word);
    if(examples.length) backContent = '<div class="notes"><b>Пример:</b> ' + esc(examples[0].kr) + ' — ' + esc(examples[0].ru) + '</div>';
    else if(word.notes) backContent = '<div class="notes">' + esc(word.notes) + '</div>';
  }
  var out = '<div class="stage">';
  out += '<button class="btn-exclude" id="exclude-word" title="Убрать это слово из упражнений">✕</button>';
  out += '<div class="card' + (state.ui.flipped?' flipped':'') + '" id="flip-card">';
  out += '<div class="face front"><div class="taegeuk-edge"></div><div class="cat-tag">' + esc(shortCat(word.category)) + '</div>' +
    '<div class="kr-word kr">' + esc(word.kr) + '</div><div class="translit mono">' + esc(word.translit) + '</div>' +
    '<div class="hint">нажмите, чтобы перевернуть</div></div>';
  out += '<div class="face back"><div class="taegeuk-edge"></div><div class="cat-tag">' + esc(shortCat(word.category)) + '</div>' +
    '<div class="meaning">' + esc(word.meaning) + '</div>' + backContent + '</div>';
  out += '</div></div>';
  out += '<div class="controls"><button class="btn btn-again" id="btn-again">Повторить</button><button class="btn btn-know" id="btn-know">Знаю</button></div>';
  return out;
}
function renderKr2Ru(q){
  var word = q.word;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="q-kr kr">' + esc(word.kr) + '</div><div class="q-translit mono">' + esc(word.translit) + ' · выберите перевод</div>';
  q.options.forEach(function(opt){
    var cls = 'opt';
    if(state.ui.chosen){ if(opt === word.meaning) cls += ' correct'; else if(opt === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + '" data-choice="' + esc(opt) + '"' + (state.ui.chosen?' disabled':'') + '>' + esc(opt) + '</button>';
  });
  out += '</div>';
  return out;
}
function renderRu2Kr(q){
  var word = q.word;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="meaning" style="text-align:center;font-size:20px;margin:10px 0 20px">' + esc(word.meaning) + '</div>';
  q.options.forEach(function(w){
    var cls = 'opt';
    if(state.ui.chosen){ if(w.kr === word.kr) cls += ' correct'; else if(w.kr === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + '" data-choice="' + esc(w.kr) + '"' + (state.ui.chosen?' disabled':'') +
      '><span class="kr">' + esc(w.kr) + '</span><span class="opt-sub mono">' + esc(w.translit) + '</span></button>';
  });
  out += '</div>';
  return out;
}
function renderSentChoice(q){
  var word = q.word, example = q.example, blank = q.blank;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="q-translit mono" style="margin-bottom:10px">выберите слово, которое подходит в пропуск</div>';
  var mid = state.ui.chosen ? ('<span class="gap-fill kr">' + esc(state.ui.chosen) + '</span>') : '<span class="gap"></span>';
  out += '<div class="sent-blank kr">' + esc(blank.before) + mid + esc(blank.after) + '</div>';
  out += '<div class="sent-ru">' + esc(example.ru) + '</div>';
  q.options.forEach(function(w){
    var cls = 'opt';
    if(state.ui.chosen){ if(w.kr === word.kr) cls += ' correct'; else if(w.kr === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + '" data-choice="' + esc(w.kr) + '"' + (state.ui.chosen?' disabled':'') +
      '><span class="kr">' + esc(w.kr) + '</span><span class="opt-sub">' + esc(w.meaning) + '</span></button>';
  });
  out += '</div>';
  return out;
}
function renderSpell(q){
  var word = q.word;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="q-translit mono" style="margin-bottom:2px">напишите слово на корейском</div>';
  out += '<div class="meaning" style="text-align:center;font-size:21px">' + esc(word.meaning) + '</div>';
  out += '<form class="type-row" id="type-form"><input class="kr" id="type-input" value="' + esc(state.ui.typedValue||'') + '" placeholder="한국어" autocomplete="off"' + (state.ui.typedResult?' disabled':'') + '/>' +
    '<button type="submit">' + (state.ui.typedResult ? 'Дальше' : 'Ответить') + '</button></form>';
  if(state.ui.typedResult){
    out += state.ui.typedResult === 'ok' ? '<div class="feedback ok">Верно!</div>' :
      ('<div class="feedback bad">Правильно: <span class="ans kr">' + esc(word.kr) + '</span> (' + esc(word.translit) + ')</div>');
  }
  return out;
}
function renderSentType(q){
  var word = q.word, example = q.example, blank = q.blank;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="q-translit mono" style="margin-bottom:10px">впишите слово (' + esc(word.meaning) + ')</div>';
  out += '<div class="sent-blank kr">' + esc(blank.before) + '<span class="gap"></span>' + esc(blank.after) + '</div>';
  out += '<div class="sent-ru">' + esc(example.ru) + '</div>';
  out += '<form class="type-row" id="type-form"><input class="kr" id="type-input" value="' + esc(state.ui.typedValue||'') + '" placeholder="한국어" autocomplete="off"' + (state.ui.typedResult?' disabled':'') + '/>' +
    '<button type="submit">' + (state.ui.typedResult ? 'Дальше' : 'Ответить') + '</button></form>';
  if(state.ui.typedResult){
    out += state.ui.typedResult === 'ok' ? '<div class="feedback ok">Верно!</div>' :
      ('<div class="feedback bad">Правильно: <span class="ans kr">' + esc(blank.matched) + '</span> — ' + esc(example.kr) + '</div>');
  }
  return out;
}
function renderAntSyn(q){
  var word = q.word;
  var label = q.relType === 'antonym' ? 'антоним' : 'синоним';
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="q-translit mono" style="margin-bottom:6px">найдите ' + label + ' к слову</div>';
  out += '<div class="q-kr kr">' + esc(word.kr) + '</div><div class="q-translit mono" style="margin-bottom:20px">' + esc(word.translit) + ' — ' + esc(word.meaning) + '</div>';
  q.options.forEach(function(w){
    var cls = 'opt';
    if(state.ui.chosen){ if(w.kr === q.target.kr) cls += ' correct'; else if(w.kr === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + '" data-choice="' + esc(w.kr) + '"' + (state.ui.chosen?' disabled':'') +
      '><span class="kr">' + esc(w.kr) + '</span><span class="opt-sub">' + esc(w.meaning) + '</span></button>';
  });
  out += '</div>';
  return out;
}
function renderGrammar(q){
  var ex = q.ex;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="q-translit mono" style="margin-bottom:10px">' + esc(ex.cat) + ' · выберите правильную форму</div>';
  var mid = state.ui.chosen ? ('<span class="gap-fill kr">' + esc(state.ui.chosen) + '</span>') : '<span class="gap"></span>';
  out += '<div class="sent-blank kr">' + esc(ex.before) + mid + esc(ex.after) + '</div>';
  out += '<div class="sent-ru">' + esc(ex.ru) + '</div>';
  q.options.forEach(function(opt){
    var cls = 'opt';
    if(state.ui.chosen){ if(opt === ex.correct) cls += ' correct'; else if(opt === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + ' kr" data-choice="' + esc(opt) + '"' + (state.ui.chosen?' disabled':'') + '>' + esc(opt) + '</button>';
  });
  if(state.ui.chosen){
    out += '<div class="feedback ' + (state.ui.chosen===ex.correct?'ok':'bad') + '">' +
      (state.ui.chosen===ex.correct ? 'Верно!' : ('Правильно: <span class="ans kr">'+esc(ex.correct)+'</span>')) +
      '<span class="note">' + esc(ex.note) + '</span></div>';
  }
  out += '</div>';
  return out;
}
function renderGrammarCard(q){
  var item = q.item;
  var out = '<div class="stage"><div class="card' + (state.ui.flipped?' flipped':'') + '" id="flip-card">';
  out += '<div class="face front"><div class="taegeuk-edge"></div><div class="cat-tag mono" style="max-width:75%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(item.lesson) + '</div>' +
    '<div class="kr-word kr">' + esc(item.pattern) + '</div>' +
    '<div class="hint">нажмите, чтобы перевернуть</div></div>';
  out += '<div class="face back"><div class="taegeuk-edge"></div><div class="cat-tag mono" style="max-width:75%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(item.lesson) + '</div>' +
    '<div class="meaning">' + esc(item.explanation) + '</div>' +
    '<div class="notes"><b>Пример:</b> <span class="kr">' + esc(item.examples[0].kr) + '</span> — ' + esc(item.examples[0].ru) + '</div></div>';
  out += '</div></div>';
  out += '<div class="controls"><button class="btn btn-again" id="gram-card-again">Повторить</button><button class="btn btn-know" id="gram-card-know">Знаю</button></div>';
  return out;
}
function renderGrammarSpell(q){
  var item = q.item;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="q-translit mono" style="margin-bottom:2px">напишите конструкцию на корейском</div>';
  out += '<div class="meaning" style="font-size:16px">' + esc(item.explanation) + '</div>';
  out += '<div class="notes"><b>Пример:</b> ' + esc(item.examples[0].ru) + '</div>';
  out += '<form class="type-row" id="type-form"><input class="kr" id="type-input" value="' + esc(state.ui.typedValue||'') + '" placeholder="한국어" autocomplete="off"' + (state.ui.typedResult?' disabled':'') + '/>' +
    '<button type="submit">' + (state.ui.typedResult ? 'Дальше' : 'Ответить') + '</button></form>';
  if(state.ui.typedResult){
    out += state.ui.typedResult === 'ok' ? '<div class="feedback ok">Верно!</div>' :
      ('<div class="feedback bad">Правильно: <span class="ans kr">' + esc(item.pattern) + '</span></div>');
    out += '<div class="notes"><span class="kr">' + esc(item.examples[0].kr) + '</span> — ' + esc(item.examples[0].ru) + '</div>';
  }
  out += '</div>';
  return out;
}
function renderExamReading(q){
  var item = q.item;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="notes kr" style="font-size:15px;line-height:1.7;margin-bottom:16px;padding:14px;background:var(--paper);border-radius:12px;max-width:none">' + esc(item.passage) + '</div>';
  out += '<div class="q-translit mono" style="text-align:left;margin-bottom:12px">' + esc(item.question) + '</div>';
  q.options.forEach(function(opt){
    var cls = 'opt';
    if(state.ui.chosen){ if(opt === item.correct) cls += ' correct'; else if(opt === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + '" data-choice="' + esc(opt) + '"' + (state.ui.chosen?' disabled':'') + '>' + esc(opt) + '</button>';
  });
  if(state.ui.chosen){
    out += '<div class="feedback ' + (state.ui.chosen===item.correct?'ok':'bad') + '">' +
      (state.ui.chosen===item.correct ? 'Верно!' : ('Правильно: <span class="ans">'+esc(item.correct)+'</span>')) + '</div>';
  }
  out += '</div>';
  return out;
}
function renderExamListening(q){
  var item = q.item;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<audio controls preload="none" style="width:100%;margin-bottom:16px" src="' + esc(encodeURI(item.audio)) + '"></audio>';
  out += '<div class="q-translit mono" style="text-align:left;margin-bottom:12px">' + esc(item.question) + '</div>';
  q.options.forEach(function(opt){
    var cls = 'opt';
    if(state.ui.chosen){ if(opt === item.correct) cls += ' correct'; else if(opt === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + '" data-choice="' + esc(opt) + '"' + (state.ui.chosen?' disabled':'') + '>' + esc(opt) + '</button>';
  });
  if(state.ui.chosen){
    out += '<div class="feedback ' + (state.ui.chosen===item.correct?'ok':'bad') + '">' +
      (state.ui.chosen===item.correct ? 'Верно!' : ('Правильно: <span class="ans">'+esc(item.correct)+'</span>')) + '</div>';
  }
  out += '</div>';
  return out;
}
function renderExamTopikReading(q){
  var item = q.item;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  if(item.passage){
    out += '<div class="notes kr" style="font-size:15px;line-height:1.7;margin-bottom:16px;padding:14px;background:var(--paper);border-radius:12px;max-width:none">' + esc(item.passage) + '</div>';
  }
  out += '<div class="q-translit mono" style="text-align:left;margin-bottom:12px">' + esc(item.question) + '</div>';
  q.options.forEach(function(opt){
    var cls = 'opt';
    if(state.ui.chosen){ if(opt === item.correct) cls += ' correct'; else if(opt === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + '" data-choice="' + esc(opt) + '"' + (state.ui.chosen?' disabled':'') + '>' + esc(opt) + '</button>';
  });
  if(state.ui.chosen){
    out += '<div class="feedback ' + (state.ui.chosen===item.correct?'ok':'bad') + '">' +
      (state.ui.chosen===item.correct ? 'Верно!' : ('Правильно: <span class="ans">'+esc(item.correct)+'</span>')) + '</div>';
  }
  out += '</div>';
  return out;
}
function renderExamOrdering(q){
  var item = q.item;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="q-translit mono" style="margin-bottom:10px">расставьте предложения в правильном порядке</div>';
  item.parts.forEach(function(p, i){
    out += '<div class="notes" style="margin-bottom:6px"><b>' + EXAM_LABELS[i] + '.</b> ' + esc(p) + '</div>';
  });
  out += '<div style="margin-top:14px"></div>';
  q.options.forEach(function(opt){
    var cls = 'opt';
    if(state.ui.chosen){ if(opt === q.correctLabel) cls += ' correct'; else if(opt === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + '" data-choice="' + esc(opt) + '"' + (state.ui.chosen?' disabled':'') + '>' + esc(opt) + '</button>';
  });
  if(state.ui.chosen){
    out += '<div class="feedback ' + (state.ui.chosen===q.correctLabel?'ok':'bad') + '">' +
      (state.ui.chosen===q.correctLabel ? 'Верно!' : ('Правильно: <span class="ans">'+esc(q.correctLabel)+'</span>')) +
      '<span class="note">' + esc(item.ru) + '</span></div>';
  }
  out += '</div>';
  return out;
}
function renderExamConstruct(q){
  var item = q.item;
  var picked = state.ui.constructPicked || [];
  var usedKeys = {};
  picked.forEach(function(k){ usedKeys[k] = true; });
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="q-translit mono" style="margin-bottom:10px">составьте предложение (' + esc(item.ru) + ')</div>';
  out += '<div class="sent-blank kr" style="min-height:34px;text-align:left;border-bottom:2px solid var(--line);padding-bottom:10px">';
  if(picked.length){
    picked.forEach(function(key, idx){
      var w = q.shuffled.find(function(x){ return x.key === key; });
      out += '<span class="gap-fill kr" data-remove="' + idx + '" style="cursor:pointer;margin-right:6px">' + esc(w ? w.text : '') + '</span>';
    });
  } else {
    out += '<span class="hint">нажимайте на слова ниже по порядку</span>';
  }
  out += '</div>';
  out += '<div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:8px">';
  q.shuffled.forEach(function(w){
    var disabled = usedKeys[w.key] || state.ui.constructResult;
    out += '<button class="opt" style="width:auto;display:inline-block;margin:0" data-tap="' + esc(w.key) + '"' + (disabled?' disabled style="opacity:.35"':'') + '>' + esc(w.text) + '</button>';
  });
  out += '</div>';
  out += '<div class="controls" style="margin-top:14px">' +
    '<button class="btn btn-ghost" id="construct-clear">Очистить</button>' +
    '<button class="btn btn-primary" id="construct-submit">' + (state.ui.constructResult ? 'Дальше' : 'Проверить') + '</button></div>';
  if(state.ui.constructResult){
    out += '<div class="feedback ' + (state.ui.constructResult==='ok'?'ok':'bad') + '">' +
      (state.ui.constructResult==='ok' ? 'Верно!' : ('Правильно: <span class="ans kr">'+esc(item.correct)+'</span>')) + '</div>';
  }
  out += '</div>';
  return out;
}
function renderExamCloze(q){
  var item = q.item;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="q-translit mono" style="margin-bottom:10px">выберите подходящее выражение</div>';
  var mid = state.ui.chosen ? ('<span class="gap-fill kr">' + esc(state.ui.chosen) + '</span>') : '<span class="gap"></span>';
  out += '<div class="sent-blank kr">' + esc(item.before) + mid + esc(item.after) + '</div>';
  q.options.forEach(function(opt){
    var cls = 'opt';
    if(state.ui.chosen){ if(opt === item.correct) cls += ' correct'; else if(opt === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + ' kr" data-choice="' + esc(opt) + '"' + (state.ui.chosen?' disabled':'') + '>' + esc(opt) + '</button>';
  });
  if(state.ui.chosen){
    out += '<div class="feedback ' + (state.ui.chosen===item.correct?'ok':'bad') + '">' +
      (state.ui.chosen===item.correct ? 'Верно!' : ('Правильно: <span class="ans kr">'+esc(item.correct)+'</span>')) +
      '<span class="note">' + esc(item.ru) + '</span></div>';
  }
  out += '</div>';
  return out;
}
function renderQWord(q){
  var item = q.item;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="q-translit mono" style="margin-bottom:10px">выберите правильное вопросительное слово</div>';
  var mid = state.ui.chosen ? ('<span class="gap-fill kr">' + esc(state.ui.chosen) + '</span>') : '<span class="gap"></span>';
  out += '<div class="sent-blank kr">' + esc(item.before) + mid + esc(item.after) + '</div>';
  q.options.forEach(function(opt){
    var cls = 'opt kr';
    if(state.ui.chosen){ if(opt === item.correct) cls += ' correct'; else if(opt === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + '" data-choice="' + esc(opt) + '"' + (state.ui.chosen?' disabled':'') + '>' + esc(opt) + '</button>';
  });
  if(state.ui.chosen){
    out += '<div class="feedback ' + (state.ui.chosen===item.correct?'ok':'bad') + '">' +
      (state.ui.chosen===item.correct ? 'Верно!' : ('Правильно: <span class="ans kr">'+esc(item.correct)+'</span>')) +
      '<span class="note">' + esc(item.ru) + '</span></div>';
  }
  out += '</div>';
  return out;
}
function renderQAnswer(q){
  var item = q.item;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="q-translit mono" style="margin-bottom:6px">выберите подходящий ответ на вопрос</div>';
  out += '<div class="q-kr kr" style="font-size:26px;text-align:left;margin-bottom:4px">' + esc(item.question) + '</div>';
  out += '<div class="q-translit mono" style="text-align:left;margin-bottom:16px">' + esc(item.ru) + '</div>';
  q.options.forEach(function(opt){
    var cls = 'opt kr';
    if(state.ui.chosen){ if(opt === item.correct) cls += ' correct'; else if(opt === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + '" data-choice="' + esc(opt) + '"' + (state.ui.chosen?' disabled':'') + '>' + esc(opt) + '</button>';
  });
  if(state.ui.chosen){
    out += '<div class="feedback ' + (state.ui.chosen===item.correct?'ok':'bad') + '">' +
      (state.ui.chosen===item.correct ? 'Верно!' : ('Правильно: <span class="ans kr">'+esc(item.correct)+'</span>')) + '</div>';
  }
  out += '</div>';
  return out;
}
function renderResponse(q){
  var item = q.item;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="q-translit mono" style="margin-bottom:10px">выберите подходящее слово</div>';
  var mid = state.ui.chosen ? ('<span class="gap-fill kr">' + esc(state.ui.chosen) + '</span>') : '<span class="gap"></span>';
  out += '<div class="sent-blank kr" style="font-size:17px">' + esc(item.before) + mid + esc(item.after) + '</div>';
  q.options.forEach(function(opt){
    var cls = 'opt kr';
    if(state.ui.chosen){ if(opt === item.correct) cls += ' correct'; else if(opt === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + '" data-choice="' + esc(opt) + '"' + (state.ui.chosen?' disabled':'') + '>' + esc(opt) + '</button>';
  });
  if(state.ui.chosen){
    out += '<div class="feedback ' + (state.ui.chosen===item.correct?'ok':'bad') + '">' +
      (state.ui.chosen===item.correct ? 'Верно!' : ('Правильно: <span class="ans kr">'+esc(item.correct)+'</span>')) +
      '<span class="note">' + esc(item.ru) + '</span></div>';
  }
  out += '</div>';
  return out;
}
/* словарная форма слова — только для раздела «Неправильные глаголы», без подсказки «обычный/неправильный» */
function baseFormLabel(item){
  if(state.themeSub !== 'irregular' || !item.word) return '';
  return '<div class="q-translit mono" style="margin-bottom:6px">словарная форма: <span class="kr">' + esc(item.word) + '</span></div>';
}
function themeTypePrompt(){
  if(state.themeSub === 'counters') return 'впишите счётное слово';
  if(state.themeSub === 'irregular') return 'впишите правильную форму';
  return 'впишите слово';
}
function renderThemeCloze(q){
  var item = q.item;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += baseFormLabel(item);
  out += '<div class="q-translit mono" style="margin-bottom:10px">выберите правильный вариант</div>';
  var mid = state.ui.chosen ? ('<span class="gap-fill kr">' + esc(state.ui.chosen) + '</span>') : '<span class="gap"></span>';
  out += '<div class="sent-blank kr" style="font-size:17px">' + esc(item.before) + mid + esc(item.after) + '</div>';
  q.options.forEach(function(opt){
    var cls = 'opt kr';
    if(state.ui.chosen){ if(opt === item.correct) cls += ' correct'; else if(opt === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + '" data-choice="' + esc(opt) + '"' + (state.ui.chosen?' disabled':'') + '>' + esc(opt) + '</button>';
  });
  if(state.ui.chosen){
    out += '<div class="feedback ' + (state.ui.chosen===item.correct?'ok':'bad') + '">' +
      (state.ui.chosen===item.correct ? 'Верно!' : ('Правильно: <span class="ans kr">'+esc(item.correct)+'</span>')) +
      '<span class="note">' + esc(item.ru) + '</span></div>';
  }
  out += '</div>';
  return out;
}
function renderCounterType(q){
  var item = q.item;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += baseFormLabel(item);
  out += '<div class="q-translit mono" style="margin-bottom:10px">' + themeTypePrompt() + '</div>';
  out += '<div class="sent-blank kr">' + esc(item.before) + '<span class="gap"></span>' + esc(item.after) + '</div>';
  out += '<div class="sent-ru">' + esc(item.ru) + '</div>';
  out += '<form class="type-row" id="type-form"><input class="kr" id="type-input" value="' + esc(state.ui.typedValue||'') + '" placeholder="한국어" autocomplete="off"' + (state.ui.typedResult?' disabled':'') + '/>' +
    '<button type="submit">' + (state.ui.typedResult ? 'Дальше' : 'Ответить') + '</button></form>';
  if(state.ui.typedResult){
    out += state.ui.typedResult === 'ok' ? '<div class="feedback ok">Верно!</div>' :
      ('<div class="feedback bad">Правильно: <span class="ans kr">' + esc(item.correct) + '</span></div>');
  }
  out += '</div>';
  return out;
}
function renderCounterTranslate(q){
  var item = q.item;
  var fullSentence = (item.before + item.correct + item.after).trim();
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += baseFormLabel(item);
  out += '<div class="q-translit mono" style="margin-bottom:10px">переведите предложение на корейский</div>';
  out += '<div class="notes" style="font-size:16px;margin-bottom:16px">' + esc(item.ru) + '</div>';
  out += '<form class="type-row" id="type-form"><input class="kr" id="type-input" value="' + esc(state.ui.typedValue||'') + '" placeholder="한국어 문장" autocomplete="off"' + (state.ui.typedResult?' disabled':'') + '/>' +
    '<button type="submit">' + (state.ui.typedResult ? 'Дальше' : 'Ответить') + '</button></form>';
  if(state.ui.typedResult){
    out += state.ui.typedResult === 'ok' ? '<div class="feedback ok">Верно!</div>' :
      ('<div class="feedback bad">Правильно: <span class="ans kr">' + esc(fullSentence) + '</span></div>');
  }
  out += '</div>';
  return out;
}
function renderThemeDate(q){
  var item = q.item;
  var out = '<div class="qcard"><div class="taegeuk-edge"></div>';
  out += '<div class="notes" style="font-size:15px;margin-bottom:16px">' + esc(item.question) + '</div>';
  q.options.forEach(function(opt){
    var cls = 'opt kr';
    if(state.ui.chosen){ if(opt === item.correct) cls += ' correct'; else if(opt === state.ui.chosen) cls += ' wrong'; }
    out += '<button class="' + cls + '" data-choice="' + esc(opt) + '"' + (state.ui.chosen?' disabled':'') + '>' + esc(opt) + '</button>';
  });
  if(state.ui.chosen){
    out += '<div class="feedback ' + (state.ui.chosen===item.correct?'ok':'bad') + '">' +
      (state.ui.chosen===item.correct ? 'Верно!' : ('Правильно: <span class="ans kr">'+esc(item.correct)+'</span>')) +
      (item.note ? '<span class="note">' + esc(item.note) + '</span>' : '') + '</div>';
  }
  out += '</div>';
  return out;
}
function renderQuestionCard(q){
  if(!q) return '<div class="qcard"><div class="empty"><b>Пусто</b>Выберите хотя бы одну категорию, чтобы начать</div></div>';
  if(q.type === 'card') return renderCard(q);
  if(q.type === 'kr2ru') return renderKr2Ru(q);
  if(q.type === 'ru2kr') return renderRu2Kr(q);
  if(q.type === 'sentchoice') return renderSentChoice(q);
  if(q.type === 'spell') return renderSpell(q);
  if(q.type === 'senttype') return renderSentType(q);
  if(q.type === 'antsyn') return renderAntSyn(q);
  if(q.type === 'grammar') return renderGrammar(q);
  if(q.type === 'exread') return renderExamReading(q);
  if(q.type === 'exlisten') return renderExamListening(q);
  if(q.type === 'extopikread') return renderExamTopikReading(q);
  if(q.type === 'exorder') return renderExamOrdering(q);
  if(q.type === 'excon') return renderExamConstruct(q);
  if(q.type === 'excloze') return renderExamCloze(q);
  if(q.type === 'qword') return renderQWord(q);
  if(q.type === 'qanswer') return renderQAnswer(q);
  if(q.type === 'response') return renderResponse(q);
  if(q.type === 'themecloze') return renderThemeCloze(q);
  if(q.type === 'themedate') return renderThemeDate(q);
  if(q.type === 'countertype') return renderCounterType(q);
  if(q.type === 'countertranslate') return renderCounterTranslate(q);
  if(q.type === 'gramcard') return renderGrammarCard(q);
  if(q.type === 'gramspell') return renderGrammarSpell(q);
  return '';
}

/* ============ RENDER: VIEWS ============ */
var NAV_ICONS = {
  practice: '<rect x="2" y="9" width="4" height="6" rx="1"/><rect x="18" y="9" width="4" height="6" rx="1"/><line x1="6" y1="12" x2="18" y2="12"/>',
  vocab: '<rect x="3" y="7" width="13" height="14" rx="2"/><rect x="8" y="3" width="13" height="14" rx="2" fill="var(--paper)"/>',
  grammar: '<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="7.5" y1="8" x2="16.5" y2="8"/><line x1="7.5" y1="12" x2="16.5" y2="12"/><line x1="7.5" y1="16" x2="13" y2="16"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="20" y2="20"/>'
};
var VIEW_GROUPS = {
  practice: [['session','Сессия'],['exam','Экзамен'],['qa','Вопросы'],['theme','Темы'],['mockexam','Пробный экзамен']],
  vocab: [['words','Слова'],['phrases','Фразы']],
  grammar: [['grammar','Грамматика']],
  search: [['search','Поиск']]
};
function groupOfView(view){
  var found = 'practice';
  Object.keys(VIEW_GROUPS).forEach(function(g){
    if(VIEW_GROUPS[g].some(function(v){ return v[0]===view; })) found = g;
  });
  return found;
}
function renderTopNav(){
  var groups = [['practice','Практика'],['vocab','Словарь'],['grammar','Грамматика'],['search','Поиск']];
  var activeGroup = groupOfView(state.view);
  var html = '<div class="top-nav">';
  groups.forEach(function(t){
    html += '<button data-navgroup="' + t[0] + '" class="' + (activeGroup===t[0]?'active':'') + '" title="' + t[1] + '" aria-label="' + t[1] + '">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + NAV_ICONS[t[0]] + '</svg>' +
      '</button>';
  });
  html += '</div>';
  return html;
}

function renderWordsView(){
  var html = '';
  html += '<div class="panel"><div class="panel-row" id="cat-toggle"><span class="label">Категории</span>' +
    '<span class="value mono">' + (state.wordsSelected.length===CATEGORIES.length ? 'все' : state.wordsSelected.length + ' из ' + CATEGORIES.length) +
    '<span class="chev' + (state.wordsCatOpen?' open':'') + '">▾</span></span></div>';
  html += '<div class="cat-actions' + (state.wordsCatOpen?' open':'') + '"><button id="cat-all">Выбрать все</button><button id="cat-none">Снять все</button></div>';
  html += '<div class="cat-grid' + (state.wordsCatOpen?' open':'') + '">';
  CATEGORIES.forEach(function(c){ html += '<div class="cat-chip' + (state.wordsSelected.indexOf(c)!==-1?' active':'') + '" data-cat="' + esc(c) + '">' + esc(shortCat(c)) + '</div>'; });
  html += '</div></div>';

  var modes = [['cards','Карточки'],['kr2ru','Слово→Перевод'],['ru2kr','Перевод→Слово'],['sentchoice','Предложение (выбор)'],['spell','Написание'],['senttype','Предложение (ввод)'],['antsyn','Антонимы/синонимы']];
  var currentModeLabel = (modes.filter(function(m){ return m[0]===state.wordsMode; })[0] || modes[0])[1];
  html += '<div class="panel"><div class="panel-row" id="wmode-toggle"><span class="label">Упражнение</span>' +
    '<span class="value mono">' + esc(currentModeLabel) + '<span class="chev' + (state.wordsModeOpen?' open':'') + '">▾</span></span></div>';
  html += '<div class="cat-grid' + (state.wordsModeOpen?' open':'') + '">';
  modes.forEach(function(m){ html += '<div class="cat-chip' + (state.wordsMode===m[0]?' active':'') + '" data-wmode="' + m[0] + '">' + m[1] + '</div>'; });
  html += '</div></div>';

  var pool = state.player.words || [];
  if(pool.length){
    var pct = Math.round((( (state.player.index % pool.length) +1)/pool.length)*100);
    html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
  }
  html += renderQuestionCard(state.player.current);
  html += resetIconBtn('reshuffle-words');
  return html;
}

function renderPhrasesView(){
  var html = '';
  html += '<div class="panel"><div class="panel-row" id="phcat-toggle"><span class="label">Ситуации</span>' +
    '<span class="value mono">' + (state.phrasesSelected.length===PHRASE_CATEGORIES.length ? 'все' : state.phrasesSelected.length + ' из ' + PHRASE_CATEGORIES.length) +
    '<span class="chev' + (state.phrasesCatOpen?' open':'') + '">▾</span></span></div>';
  html += '<div class="cat-actions' + (state.phrasesCatOpen?' open':'') + '"><button id="phcat-all">Выбрать все</button><button id="phcat-none">Снять все</button></div>';
  html += '<div class="cat-grid' + (state.phrasesCatOpen?' open':'') + '">';
  PHRASE_CATEGORIES.forEach(function(c){ html += '<div class="cat-chip' + (state.phrasesSelected.indexOf(c)!==-1?' active':'') + '" data-phcat="' + esc(c) + '">' + esc(shortCat(c)) + '</div>'; });
  html += '</div></div>';

  var modes = [['cards','Карточки'],['kr2ru','Фраза→Перевод'],['ru2kr','Перевод→Фраза']];
  var currentModeLabel = (modes.filter(function(m){ return m[0]===state.phrasesMode; })[0] || modes[0])[1];
  html += '<div class="panel"><div class="panel-row" id="phmode-toggle"><span class="label">Упражнение</span>' +
    '<span class="value mono">' + esc(currentModeLabel) + '<span class="chev' + (state.phrasesModeOpen?' open':'') + '">▾</span></span></div>';
  html += '<div class="cat-grid' + (state.phrasesModeOpen?' open':'') + '">';
  modes.forEach(function(m){ html += '<div class="cat-chip' + (state.phrasesMode===m[0]?' active':'') + '" data-phmode="' + m[0] + '">' + m[1] + '</div>'; });
  html += '</div></div>';

  var pool = state.player.phwords || [];
  if(pool.length){
    var pct = Math.round((( (state.player.phindex % pool.length) +1)/pool.length)*100);
    html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
  }
  html += renderQuestionCard(state.player.phcurrent);
  html += resetIconBtn('reshuffle-phrases');
  return html;
}

function renderRefDetail(it){
  var html = '<div class="ref-detail">';
  html += '<div>' + mdRich(it.explanation) + '</div>';
  if(it.usage && it.usage.length){
    html += '<div class="rd-title">В каких случаях используется</div><ul>';
    it.usage.forEach(function(u){ html += '<li>' + mdRich(u) + '</li>'; });
    html += '</ul>';
  }
  if(it.rules && it.rules.length){
    html += '<div class="rd-title">Правила грамматики</div><ul>';
    it.rules.forEach(function(r){ html += '<li>' + mdRich(r) + '</li>'; });
    html += '</ul>';
  }
  if(it.vocab && it.vocab.length){
    html += '<div class="rd-title">Основные слова</div><table>';
    it.vocab.forEach(function(v){ html += '<tr><td class="kr">' + esc(v.kr) + '</td><td>' + esc(v.ru) + '</td></tr>'; });
    html += '</table>';
  }
  var examples = it.examples || (it.example ? [it.example] : []);
  if(examples.length){
    html += '<div class="rd-title">Примеры</div>';
    examples.forEach(function(ex){ html += '<div class="rd-ex"><span class="kr">' + esc(ex.kr) + '</span> — ' + esc(ex.ru) + '</div>'; });
  }
  html += '</div>';
  return html;
}
function renderGrammarReference(){
  var html = '<div class="panel"><div class="panel-row" id="gcat-toggle"><span class="label">Темы</span>' +
    '<span class="value mono">' + (state.grammarSelected.length===GRAMMAR_CATS.length ? 'все' : state.grammarSelected.length + ' из ' + GRAMMAR_CATS.length) +
    '<span class="chev' + (state.grammarCatOpen?' open':'') + '">▾</span></span></div>';
  html += '<div class="cat-actions' + (state.grammarCatOpen?' open':'') + '"><button id="gcat-all">Выбрать все</button><button id="gcat-none">Снять все</button></div>';
  html += '<div class="cat-grid' + (state.grammarCatOpen?' open':'') + '">';
  GRAMMAR_CATS.forEach(function(c){ html += '<div class="cat-chip" data-gcat="' + esc(c) + '" style="' + (state.grammarSelected.indexOf(c)!==-1?'':'opacity:.5') + '">' + esc(shortGrammarCat(c)) + '</div>'; });
  html += '</div></div>';

  html += '<div class="sub-toggle" style="margin-bottom:14px">' +
    '<button data-grefview="topic" class="' + (state.grammarRefView==='topic'?'active':'') + '">По темам</button>' +
    '<button data-grefview="lesson" class="' + (state.grammarRefView==='lesson'?'active':'') + '">По урокам</button></div>';

  html += '<div class="qcard">';
  function renderRow(it){
    var open = !!state.grammarExpanded[it.pattern];
    var out = '<div class="ref-item" data-refitem="' + esc(it.pattern) + '"><div class="ref-pattern kr">' + esc(it.pattern) + '</div><div class="ref-desc">' + esc(it.desc) + '</div><div class="ref-lesson mono">' + esc(it.lesson) + '</div></div>';
    if(open) out += renderRefDetail(it);
    return out;
  }
  if(state.grammarRefView === 'lesson'){
    var byLesson = {};
    GRAMMAR_TOPICS.forEach(function(topic){
      if(state.grammarSelected.indexOf(topic.category) === -1) return;
      topic.items.forEach(function(it){
        (it.lessons || []).forEach(function(l){ (byLesson[l] = byLesson[l] || []).push(it); });
      });
    });
    Object.keys(byLesson).map(Number).sort(function(a,b){ return a-b; }).forEach(function(l){
      var lessonOpen = !!state.grammarLessonOpen[l];
      html += '<div class="topic-header" data-lessontoggle="' + l + '"><span>Урок ' + l + '</span><span class="chev' + (lessonOpen?' open':'') + '">▾</span></div>';
      if(lessonOpen){
        byLesson[l].forEach(function(it){ html += renderRow(it); });
      }
    });
  } else {
    GRAMMAR_TOPICS.forEach(function(topic){
      if(state.grammarSelected.indexOf(topic.category) === -1) return;
      var topicOpen = !!state.grammarTopicOpen[topic.category];
      html += '<div class="topic-header" data-topictoggle="' + esc(topic.category) + '"><span>' + esc(shortGrammarCat(topic.category)) + '</span><span class="chev' + (topicOpen?' open':'') + '">▾</span></div>';
      if(topicOpen){
        var lastGroup = null;
        topic.items.forEach(function(it){
          if(it.group && it.group !== lastGroup){ html += '<div class="ref-group">' + esc(it.group) + '</div>'; lastGroup = it.group; }
          html += renderRow(it);
        });
        if(topic.tips){
          html += '<div class="tips-box">' + esc(topic.tips.replace(/\*\*/g,'')) + '</div>';
        }
      }
    });
  }
  html += '</div>';
  return html;
}
function renderGrammarPractice(){
  var html = '<div class="panel"><div class="panel-row" id="gcat-toggle"><span class="label">Темы</span>' +
    '<span class="value mono">' + (state.grammarSelected.length===GRAMMAR_CATS.length ? 'все' : state.grammarSelected.length + ' из ' + GRAMMAR_CATS.length) +
    '<span class="chev' + (state.grammarCatOpen?' open':'') + '">▾</span></span></div>';
  html += '<div class="cat-actions' + (state.grammarCatOpen?' open':'') + '"><button id="gcat-all">Выбрать все</button><button id="gcat-none">Снять все</button></div>';
  html += '<div class="cat-grid' + (state.grammarCatOpen?' open':'') + '">';
  GRAMMAR_CATS.forEach(function(c){ html += '<div class="cat-chip' + (state.grammarSelected.indexOf(c)!==-1?' active':'') + '" data-gcat="' + esc(c) + '">' + esc(shortGrammarCat(c)) + '</div>'; });
  html += '</div></div>';
  var pool = state.player.gwords || [];
  if(pool.length){
    var pct = Math.round((( (state.player.gindex % pool.length) +1)/pool.length)*100);
    html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
  }
  html += renderQuestionCard(state.player.gcurrent);
  html += resetIconBtn('reshuffle-grammar');
  return html;
}
function renderGrammarCards(){
  var html = '<div class="panel"><div class="panel-row" id="gcat-toggle"><span class="label">Темы</span>' +
    '<span class="value mono">' + (state.grammarSelected.length===GRAMMAR_CATS.length ? 'все' : state.grammarSelected.length + ' из ' + GRAMMAR_CATS.length) +
    '<span class="chev' + (state.grammarCatOpen?' open':'') + '">▾</span></span></div>';
  html += '<div class="cat-actions' + (state.grammarCatOpen?' open':'') + '"><button id="gcat-all">Выбрать все</button><button id="gcat-none">Снять все</button></div>';
  html += '<div class="cat-grid' + (state.grammarCatOpen?' open':'') + '">';
  GRAMMAR_CATS.forEach(function(c){ html += '<div class="cat-chip' + (state.grammarSelected.indexOf(c)!==-1?' active':'') + '" data-gcat="' + esc(c) + '">' + esc(shortGrammarCat(c)) + '</div>'; });
  html += '</div></div>';
  var modes = [['flip','Карточки'],['type','Написание']];
  html += '<div class="sub-toggle" style="margin-bottom:14px">';
  modes.forEach(function(m){ html += '<button data-gcardmode="' + m[0] + '" class="' + (state.grammarCardMode===m[0]?'active':'') + '">' + m[1] + '</button>'; });
  html += '</div>';
  var pool = state.player.gcwords || [];
  if(pool.length){
    var pct = Math.round((( (state.player.gcindex % pool.length) +1)/pool.length)*100);
    html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
  }
  html += renderQuestionCard(state.player.gccurrent);
  html += resetIconBtn('reshuffle-gramcards');
  return html;
}
function renderGrammarView(){
  var html = '<div class="sub-toggle">' +
    '<button data-gsub="reference" class="' + (state.grammarSub==='reference'?'active':'') + '">Справочник</button>' +
    '<button data-gsub="practice" class="' + (state.grammarSub==='practice'?'active':'') + '">Тренировка</button>' +
    '<button data-gsub="cards" class="' + (state.grammarSub==='cards'?'active':'') + '">Карточки</button></div>';
  html += state.grammarSub === 'reference' ? renderGrammarReference()
    : state.grammarSub === 'cards' ? renderGrammarCards()
    : renderGrammarPractice();
  return html;
}

function renderSessionSetup(){
  var html = '<div class="qcard">';
  html += '<div class="meaning" style="text-align:center;font-size:19px;margin-bottom:6px">Общая сессия</div>';
  html += '<div class="notes" style="text-align:center;margin:0 auto 6px;max-width:420px">Карточки → слово→перевод → перевод→слово → предложение (выбор) → написание → предложение (ввод) → антонимы/синонимы → грамматика</div>';
  html += '</div>';

  html += '<div class="q-translit mono" style="margin:14px 0 6px">откуда брать слова и грамматику</div>';
  html += '<div class="sub-toggle">' +
    '<button data-sessmode="lesson" class="' + (state.session.mode==='lesson'?'active':'') + '">По теме (урок)</button>' +
    '<button data-sessmode="category" class="' + (state.session.mode==='category'?'active':'') + '">По категории слов</button></div>';

  if(state.session.mode === 'lesson'){
    html += '<div class="panel"><div class="panel-row" id="lesson-toggle"><span class="label">Урок (1–16)</span>' +
      '<span class="value mono">' + (state.session.lessonSelected.length===16 ? 'все' : state.session.lessonSelected.length + ' из 16') +
      '<span class="chev' + (state.session.lessonOpen?' open':'') + '">▾</span></span></div>';
    html += '<div class="cat-actions' + (state.session.lessonOpen?' open':'') + '"><button id="lesson-all">Выбрать все</button><button id="lesson-none">Снять все</button></div>';
    html += '<div class="cat-grid' + (state.session.lessonOpen?' open':'') + '">';
    for(var l=1;l<=16;l++){
      html += '<div class="cat-chip' + (state.session.lessonSelected.indexOf(l)!==-1?' active':'') + '" data-lesson="' + l + '">' + l + '과</div>';
    }
    html += '</div>';
    var lessonCats = categoriesForLessons(state.session.lessonSelected);
    html += '<div class="hint" style="margin-top:8px">слова из тем: ' + (lessonCats.length ? lessonCats.map(shortCat).join(', ') : '—') + '</div></div>';
  } else {
    html += '<div class="panel"><div class="panel-row" id="sesscat-toggle"><span class="label">Категория слов</span>' +
      '<span class="value mono">' + (state.session.catSelected.length===CATEGORIES.length ? 'все' : state.session.catSelected.length + ' из ' + CATEGORIES.length) +
      '<span class="chev' + (state.session.catOpen?' open':'') + '">▾</span></span></div>';
    html += '<div class="cat-actions' + (state.session.catOpen?' open':'') + '"><button id="sesscat-all">Выбрать все</button><button id="sesscat-none">Снять все</button></div>';
    html += '<div class="cat-grid' + (state.session.catOpen?' open':'') + '">';
    CATEGORIES.forEach(function(c){ html += '<div class="cat-chip' + (state.session.catSelected.indexOf(c)!==-1?' active':'') + '" data-sesscat="' + esc(c) + '">' + esc(shortCat(c)) + '</div>'; });
    html += '</div></div>';
  }

  html += '<div class="qcard" style="margin-top:14px">';
  html += '<div class="q-translit mono">сколько слов взять в сессию</div>';
  html += '<div class="size-chips">';
  [10,20,30].forEach(function(n){ html += '<div class="size-chip' + (state.session.size===n?' active':'') + '" data-size="' + n + '">' + n + '</div>'; });
  html += '</div>';
  html += '<div class="q-translit mono" style="margin-top:16px">порядок прохождения</div>';
  html += '<div class="sub-toggle" style="margin-top:8px">' +
    '<button data-ordermode="sequential" class="' + (state.session.orderMode==='sequential'?'active':'') + '">По этапам</button>' +
    '<button data-ordermode="mixed" class="' + (state.session.orderMode==='mixed'?'active':'') + '">Вперемешку</button></div>';
  if(state.session.orderMode !== 'mixed'){
    html += '<div class="hint" style="margin-top:8px">сначала все карточки, потом все переводы и т.д. по очереди</div>';
  }
  html += '<div class="controls" style="margin-top:14px"><button class="btn btn-primary" id="start-session">Начать сессию</button></div>';
  if(state.session.emptyWarning){
    html += '<div class="feedback bad" style="margin-top:10px">Нет слов под выбранные фильтры — выберите хотя бы один урок или категорию.</div>';
  }
  html += '</div>';
  return html;
}
function renderSessionRunning(){
  if(state.session.orderMode === 'mixed'){
    var item = currentMQItem();
    if(!item) return '<div class="qcard"><div class="empty"><b>Пусто</b></div></div>';
    var phase = state.session.phases[state.session.phaseIdx];
    var masteredInPhase = phase.items.length - state.session.mq.items.length;
    var html = '<div class="stage-header"><span class="stage-label">Этап ' + (state.session.phaseIdx+1) + ' из ' + state.session.phases.length + ': ' + esc(phase.label) + '</span>' +
      '<span class="stage-count mono">' + masteredInPhase + '/' + phase.items.length + '</span></div>';
    var pct = Math.round((masteredInPhase/phase.items.length)*100);
    html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
    html += renderQuestionCard(item.q);
    html += resetIconBtn('session-back-to-setup', 'Прервать сессию и вернуться к выбору');
    return html;
  }
  var st = currentStage();
  if(!st) return '<div class="qcard"><div class="empty"><b>Пусто</b></div></div>';
  var q = currentSessionQuestion();
  var retrying = !!state.retry.active.session;
  var html = '<div class="stage-header"><span class="stage-label">Этап ' + (state.session.stageIdx+1) + ' из ' + state.session.stages.length + ': ' + esc(st.label) + '</span>' +
    '<span class="stage-count mono">' + (retrying ? 'Повторение' : (st.index+1) + '/' + st.queue.length) + '</span></div>';
  var pct = Math.round((Math.min(st.index+1, st.queue.length)/st.queue.length)*100);
  html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
  html += renderQuestionCard(q);
  html += resetIconBtn('session-back-to-setup', 'Прервать сессию и вернуться к выбору');
  return html;
}
function renderSessionDone(){
  var html = '<div class="qcard"><div class="meaning" style="text-align:center;font-size:19px;margin-bottom:14px">Сессия завершена 🎉</div>';
  state.session.statsList.forEach(function(st){
    html += '<div class="summary-row"><span>' + esc(st.label) + '</span><span class="val">' + st.correct + ' / ' + st.total + '</span></div>';
  });
  html += '<div class="controls" style="margin-top:16px"><button class="btn btn-primary" id="restart-session">Новая сессия</button></div>';
  html += '</div>';
  return html;
}
function renderSessionView(){
  if(state.session.phase === 'setup') return renderSessionSetup();
  if(state.session.phase === 'running') return renderSessionRunning();
  return renderSessionDone();
}

function renderExamView(){
  var subs = [['reading','Чтение'],['ordering','Порядок'],['construct','Составь'],['cloze','Вставь']];
  if(EXAM_DATA.listening && EXAM_DATA.listening.length) subs.push(['listening','Аудирование']);
  if(EXAM_DATA.topikReading && EXAM_DATA.topikReading.length) subs.push(['topikReading','Чтение TOPIK']);
  var currentLabel = (subs.filter(function(s){ return s[0]===state.examSub; })[0] || subs[0])[1];
  var html = '<div class="panel"><div class="panel-row" id="examsub-toggle"><span class="label">Тип задания</span>' +
    '<span class="value mono">' + esc(currentLabel) + '<span class="chev' + (state.examSubOpen?' open':'') + '">▾</span></span></div>';
  html += '<div class="cat-grid' + (state.examSubOpen?' open':'') + '">';
  subs.forEach(function(s){ html += '<div class="cat-chip' + (state.examSub===s[0]?' active':'') + '" data-examsub="' + s[0] + '">' + s[1] + '</div>'; });
  html += '</div></div>';
  var pool = state.player.exwords || [];
  if(pool.length){
    var pct = Math.round((( (state.player.exindex % pool.length) +1)/pool.length)*100);
    html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
  }
  html += renderQuestionCard(state.player.excurrent);
  html += resetIconBtn('reshuffle-exam');
  return html;
}

function renderMockPick(){
  var exams = listMockExams();
  var html = '<div class="panel"><div class="meaning" style="text-align:center;font-size:19px">Выберите экзамен</div>';
  if(exams.length){
    html += '<div class="cat-grid open">';
    exams.forEach(function(exam){
      var counts = exam.listeningCount ? exam.listeningCount + ' аудирование + ' + exam.readingCount + ' чтение' : exam.readingCount + ' чтение';
      html += '<div class="cat-chip" data-mockstart="' + esc(exam.key) + '">' + exam.num + ' · ' + counts + '</div>';
    });
    html += '</div>';
  } else {
    html += '<div class="empty">Нет доступных экзаменов</div>';
  }
  html += '</div>';
  return html;
}
function renderMockRunning(){
  var entry = state.mockExam.queue[state.mockExam.index];
  if(!entry) return '<div class="qcard"><div class="empty"><b>Пусто</b></div></div>';
  var section = entry.kind === 'exlisten' ? 'Аудирование' : 'Чтение';
  var html = '<div class="stage-header"><span class="stage-label">' + section + ' · № ' + entry.num + '</span>' +
    '<span class="stage-count mono">Вопрос ' + (state.mockExam.index+1) + ' из ' + state.mockExam.queue.length + '</span></div>';
  var pct = Math.round(((state.mockExam.index+1)/state.mockExam.queue.length)*100);
  html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
  html += renderQuestionCard(state.player.mockcurrent);
  html += '<div class="controls"><button class="btn" id="mock-quit">Выйти к списку</button></div>';
  return html;
}
function renderMockDone(){
  var html = '<div class="qcard"><div class="meaning" style="text-align:center;font-size:19px;margin-bottom:14px">Экзамен пройден 🎉</div>';
  if(state.mockExam.listeningTotal > 0){
    html += '<div class="summary-row"><span>Аудирование</span><span class="val">' + state.mockExam.listeningCorrect + ' / ' + state.mockExam.listeningTotal + '</span></div>';
  }
  html += '<div class="summary-row"><span>Чтение</span><span class="val">' + state.mockExam.readingCorrect + ' / ' + state.mockExam.readingTotal + '</span></div>';
  html += '<div class="controls" style="margin-top:16px"><button class="btn btn-primary" id="mock-restart">Выбрать другой экзамен</button></div>';
  html += '</div>';
  return html;
}
function renderMockExamView(){
  if(state.mockExam.phase === 'pick') return renderMockPick();
  if(state.mockExam.phase === 'running') return renderMockRunning();
  return renderMockDone();
}

function renderQAView(){
  var subs = [['qword','Вопрос. слова'],['qanswer','Вопрос → ответ'],['response','Ответы и связки']];
  var currentLabel = (subs.filter(function(s){ return s[0]===state.qaSub; })[0] || subs[0])[1];
  var html = '<div class="panel"><div class="panel-row" id="qasub-toggle"><span class="label">Тип задания</span>' +
    '<span class="value mono">' + esc(currentLabel) + '<span class="chev' + (state.qaSubOpen?' open':'') + '">▾</span></span></div>';
  html += '<div class="cat-grid' + (state.qaSubOpen?' open':'') + '">';
  subs.forEach(function(s){ html += '<div class="cat-chip' + (state.qaSub===s[0]?' active':'') + '" data-qasub="' + s[0] + '">' + s[1] + '</div>'; });
  html += '</div></div>';
  var pool = state.player.qawords || [];
  if(pool.length){
    var pct = Math.round((( (state.player.qaindex % pool.length) +1)/pool.length)*100);
    html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
  }
  html += renderQuestionCard(state.player.qacurrent);
  html += resetIconBtn('reshuffle-qa');
  return html;
}

/* ============ ДОБАВЛЕНИЕ СЛОВ ЧЕРЕЗ AI ============ */
var LLM_API_BASE = 'https://korean-flashcards-roan.vercel.app';
var LLM_APP_SECRET = '37e366d6d1a1d586afd7d993b5d0910fed3cd21cc2ea88a2';
async function llmRequest(path, body){
  var res = await fetch(LLM_API_BASE + path, {
    method: 'POST',
    headers: {'Content-Type':'application/json', 'X-App-Secret': LLM_APP_SECRET},
    body: JSON.stringify(body)
  });
  var json = await res.json().catch(function(){ return {}; });
  if(!res.ok) throw new Error(json.error || ('HTTP ' + res.status));
  return json;
}
async function generateWordViaAI(){
  var input = state.aiInput.trim();
  if(!input){ state.aiError = 'Введите слово или значение'; render(); return; }
  state.aiLoading = true; state.aiError = ''; state.aiPreview = null;
  render();
  try{
    var word = await llmRequest('/api/generate-word', {input: input});
    if(/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(input) && input !== word.kr){
      word.correctedFrom = input;
    }
    state.aiPreview = word;
  }catch(e){
    state.aiError = e.message || 'Не удалось сгенерировать слово';
  }
  state.aiLoading = false;
  render();
}
async function confirmAddWord(){
  if(!state.aiPreview) return;
  state.aiSaving = true; state.aiError = '';
  render();
  try{
    await llmRequest('/api/add-word', state.aiPreview);
    var group = RAW.filter(function(c){ return c.category === state.aiPreview.category; })[0];
    if(!group){
      group = {category: state.aiPreview.category, words: []};
      RAW.push(group);
    }
    group.words.push({kr: state.aiPreview.kr, translit: state.aiPreview.translit, meaning: state.aiPreview.meaning,
      notes: state.aiPreview.notes || '', related: null, examples: state.aiPreview.examples});
    initData();
    if(state.aiPreview.newCategory){
      if(state.wordsSelected.indexOf(state.aiPreview.category) === -1) state.wordsSelected.push(state.aiPreview.category);
      if(state.session.catSelected.indexOf(state.aiPreview.category) === -1) state.session.catSelected.push(state.aiPreview.category);
    }
    resetWordsQueue();
    state.aiPreview = null;
    state.aiInput = '';
  }catch(e){
    state.aiError = e.message || 'Не удалось сохранить слово';
  }
  state.aiSaving = false;
  render();
}
function cancelAiPreview(){ state.aiPreview = null; state.aiError = ''; render(); }

function searchWords(query){
  var q = query.trim().toLowerCase();
  if(!q) return [];
  var results = [];
  ALL_WORDS.forEach(function(w){
    var kr = w.kr.toLowerCase();
    var tr = (w.translit||'').toLowerCase();
    var mean = w.meaning.toLowerCase();
    var score = -1;
    if(kr === q || tr === q) score = 0;
    else if(kr.indexOf(q) === 0 || tr.indexOf(q) === 0 || mean.indexOf(q) === 0) score = 1;
    else if(kr.indexOf(q) !== -1 || tr.indexOf(q) !== -1 || mean.indexOf(q) !== -1) score = 2;
    if(score !== -1) results.push({w: w, score: score});
  });
  results.sort(function(a,b){ return a.score - b.score || a.w.kr.length - b.w.kr.length; });
  return results.map(function(r){ return r.w; });
}
function renderSearchResult(w){
  var out = '<div class="search-item">';
  out += '<div class="search-row"><span class="kr search-kr">' + esc(w.kr) + '</span><span class="translit mono">' + esc(w.translit) + '</span></div>';
  out += '<div class="search-meaning">' + esc(w.meaning) + '</div>';
  out += '<div class="search-cat mono">' + esc(shortCat(w.category)) + '</div>';
  if(w.examples && w.examples.length){
    out += '<div class="notes" style="margin-top:8px"><b>Пример:</b> ' + esc(w.examples[0].kr) + ' — ' + esc(w.examples[0].ru) + '</div>';
  }
  if(w.related){
    var relLabel = w.related.type === 'antonym' ? 'Антоним' : 'Синоним';
    out += '<div class="notes" style="margin-top:4px"><b>' + relLabel + ':</b> ' + esc(w.related.target) + '</div>';
  }
  out += '</div>';
  return out;
}
function renderSearchResultsBody(){
  var html = '';
  if(!state.searchQuery.trim()){
    html += '<div class="empty"><b>Начните вводить</b>Ищет по корейскому слову, транслитерации и переводу</div>';
  } else {
    var results = searchWords(state.searchQuery);
    if(!results.length){
      html += '<div class="empty"><b>Ничего не найдено</b>Попробуйте другое слово</div>';
    } else {
      var shown = results.slice(0, 60);
      html += '<div class="hint" style="margin:4px 0 10px">найдено: ' + results.length + (results.length > shown.length ? ' (показаны первые ' + shown.length + ')' : '') + '</div>';
      shown.forEach(function(w){ html += renderSearchResult(w); });
    }
  }
  return html;
}
function renderSearchView(){
  var html = '<div class="qcard">';
  html += '<input type="text" id="search-input" class="search-input" placeholder="Введите слово на корейском или переводе..." value="' + esc(state.searchQuery) + '" autocomplete="off"/>';
  html += '</div>';

  html += '<div class="panel" style="margin-top:14px"><div class="panel-row" id="ai-panel-toggle"><span class="label">Добавить слово через AI</span>' +
    '<span class="value mono"><span class="chev' + (state.aiPanelOpen?' open':'') + '">▾</span></span></div>';
  if(state.aiPanelOpen){
    if(state.aiPreview){
      var p = state.aiPreview;
      if(p.correctedFrom){ html += '<div class="feedback ok" style="margin-top:14px">Вы ввели «' + esc(p.correctedFrom) + '» — похоже, это опечатка. Найдено: «' + esc(p.kr) + '».</div>'; }
      html += '<div class="search-item" style="margin-top:' + (p.correctedFrom ? '10px' : '14px') + '">' +
        '<div class="search-row"><span class="kr search-kr">' + esc(p.kr) + '</span><span class="translit mono">' + esc(p.translit) + '</span></div>' +
        '<div class="search-meaning">' + esc(p.meaning) + '</div>' +
        '<div class="search-cat mono">' + esc(shortCat(p.category)) + (p.newCategory ? ' · новая категория' : '') + '</div>';
      if(p.notes){ html += '<div class="notes" style="margin-top:6px">' + esc(p.notes) + '</div>'; }
      if(p.examples && p.examples.length){ html += '<div class="notes" style="margin-top:6px"><b>Пример:</b> <span class="kr">' + esc(p.examples[0].kr) + '</span> — ' + esc(p.examples[0].ru) + '</div>'; }
      html += '</div>';
      if(state.aiError){ html += '<div class="feedback bad">' + esc(state.aiError) + '</div>'; }
      html += '<div class="controls">' +
        '<button class="btn btn-ghost" id="ai-cancel"' + (state.aiSaving?' disabled':'') + '>Отмена</button>' +
        '<button class="btn btn-know" id="ai-confirm"' + (state.aiSaving?' disabled':'') + '>' + (state.aiSaving?'Сохраняю…':'Добавить в словарь') + '</button>' +
        '</div>';
    } else {
      html += '<input type="text" id="ai-input" class="search-input" style="margin-top:14px" placeholder="Слово на корейском или значение по-русски" autocomplete="off" value="' + esc(state.aiInput) + '"' + (state.aiLoading?' disabled':'') + '/>';
      if(state.aiError){ html += '<div class="feedback bad">' + esc(state.aiError) + '</div>'; }
      html += '<div class="controls"><button class="btn btn-know" id="ai-generate" style="width:100%"' + (state.aiLoading?' disabled':'') + '>' + (state.aiLoading?'Генерирую…':'Сгенерировать') + '</button></div>';
    }
  }
  html += '</div>';

  var excludedWordIds = Object.keys(state.excluded).filter(function(id){ return WORDS_BY_ID[id]; });
  html += '<div class="panel" style="margin-top:14px"><div class="panel-row" id="excluded-toggle"><span class="label">Скрытые слова</span>' +
    '<span class="value mono">' + excludedWordIds.length + '<span class="chev' + (state.excludedPanelOpen?' open':'') + '">▾</span></span></div>';
  if(state.excludedPanelOpen){
    if(!excludedWordIds.length){
      html += '<div class="hint" style="padding:2px 2px 6px">Пока нет скрытых слов</div>';
    } else {
      html += '<div class="excluded-list">';
      excludedWordIds.forEach(function(id){
        var w = WORDS_BY_ID[id];
        if(!w) return;
        html += '<div class="excluded-row"><span class="kr">' + esc(w.kr) + '</span>' +
          '<span class="excluded-meaning">' + esc(w.meaning) + '</span>' +
          '<button data-restore="' + esc(id) + '">Вернуть</button></div>';
      });
      html += '</div>';
    }
  }
  html += '</div>';

  var excludedPhraseIds = Object.keys(state.excluded).filter(function(id){ return PHRASES_BY_ID[id]; });
  html += '<div class="panel" style="margin-top:14px"><div class="panel-row" id="excluded-ph-toggle"><span class="label">Скрытые фразы</span>' +
    '<span class="value mono">' + excludedPhraseIds.length + '<span class="chev' + (state.excludedPhPanelOpen?' open':'') + '">▾</span></span></div>';
  if(state.excludedPhPanelOpen){
    if(!excludedPhraseIds.length){
      html += '<div class="hint" style="padding:2px 2px 6px">Пока нет скрытых фраз</div>';
    } else {
      html += '<div class="excluded-list">';
      excludedPhraseIds.forEach(function(id){
        var p = PHRASES_BY_ID[id];
        if(!p) return;
        html += '<div class="excluded-row"><span class="kr">' + esc(p.kr) + '</span>' +
          '<span class="excluded-meaning">' + esc(p.meaning) + '</span>' +
          '<button data-restore="' + esc(id) + '">Вернуть</button></div>';
      });
      html += '</div>';
    }
  }
  html += '</div>';

  html += '<div id="search-results-body">' + renderSearchResultsBody() + '</div>';
  return html;
}

function renderThemeView(){
  var subs = [['counters','Счётные слова'],['numbers','Числительные'],['datetime','Даты и время'],['honorific','Уважительно'],['position','Место'],['irregular','Неправильные глаголы']];
  var currentLabel = (subs.filter(function(s){ return s[0]===state.themeSub; })[0] || subs[0])[1];
  var html = '<div class="panel"><div class="panel-row" id="themesub-toggle"><span class="label">Тема</span>' +
    '<span class="value mono">' + esc(currentLabel) + '<span class="chev' + (state.themeSubOpen?' open':'') + '">▾</span></span></div>';
  html += '<div class="cat-grid' + (state.themeSubOpen?' open':'') + '">';
  subs.forEach(function(s){ html += '<div class="cat-chip' + (state.themeSub===s[0]?' active':'') + '" data-themesub="' + s[0] + '">' + s[1] + '</div>'; });
  html += '</div></div>';
  if(THEME_MODE_SECTIONS.indexOf(state.themeSub) !== -1){
    var modes = [['choice','Выбор'],['type','Впишите слово'],['translate','Переведите'],['mixed','Смешанный']];
    html += '<div class="sub-toggle" style="margin-bottom:14px;flex-wrap:wrap">';
    modes.forEach(function(m){ html += '<button data-countermode="' + m[0] + '" style="font-size:11.5px;padding:9px 4px;min-width:70px" class="' + (state.themeCounterMode===m[0]?'active':'') + '">' + m[1] + '</button>'; });
    html += '</div>';
  }
  var pool = state.player.thwords || [];
  if(pool.length){
    var pct = Math.round((( (state.player.thindex % pool.length) +1)/pool.length)*100);
    html += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
  }
  html += renderQuestionCard(state.player.thcurrent);
  html += resetIconBtn('reshuffle-theme');
  return html;
}

/* ============ MAIN RENDER ============ */
function render(){
  var root = document.getElementById('app');
  var s = statsOverall();
  var html = '';
  html += '<header><div class="brand"><svg width="30" height="30" viewBox="0 0 40 40">' +
    '<circle cx="20" cy="20" r="19" fill="#fff" stroke="#DDD5C2" stroke-width="1"/>' +
    '<path d="M20 1 A19 19 0 0 1 20 39 A9.5 9.5 0 0 1 20 20 A9.5 9.5 0 0 0 20 1 Z" fill="#C23B34"/>' +
    '<path d="M20 39 A19 19 0 0 1 20 1 A9.5 9.5 0 0 1 20 20 A9.5 9.5 0 0 0 20 39 Z" fill="#1F4E8C"/></svg>' +
    '<div><h1>단어장 — Тренажёр</h1><div class="sub mono">' + s.total + ' слов · ' + GRAMMAR_EXERCISES.length + ' упражнений грамматики</div></div></div>';
  html += '<div class="stats-pill"><span class="dot" style="background:#4C7A5E"></span><b>' + s.known + '</b><span class="dot" style="background:#B4802A"></span><b>' + s.learning + '</b></div></header>';
  html += renderTopNav();

  if(state.loaded){
    var groupMembers = VIEW_GROUPS[groupOfView(state.view)];
    if(groupMembers.length > 1){
      html += '<div class="sub-toggle">';
      groupMembers.forEach(function(v){ html += '<button data-view="' + v[0] + '" class="' + (state.view===v[0]?'active':'') + '">' + v[1] + '</button>'; });
      html += '</div>';
    }
  }

  if(!state.loaded){ html += '<div class="qcard"><div class="empty">Загрузка…</div></div>'; }
  else if(state.view === 'session') html += renderSessionView();
  else if(state.view === 'words') html += renderWordsView();
  else if(state.view === 'phrases') html += renderPhrasesView();
  else if(state.view === 'grammar') html += renderGrammarView();
  else if(state.view === 'exam') html += renderExamView();
  else if(state.view === 'mockexam') html += renderMockExamView();
  else if(state.view === 'qa') html += renderQAView();
  else if(state.view === 'theme') html += renderThemeView();
  else if(state.view === 'search') html += renderSearchView();

  html += '<footer>단어장 · прогресс сохраняется автоматически</footer>';
  root.innerHTML = html;
  attachHandlers();
  if(state.view === 'search'){
    var si = document.getElementById('search-input');
    if(si){ si.focus(); var len = si.value.length; if(si.setSelectionRange) si.setSelectionRange(len, len); }
  }
}

/* ============ HANDLERS ============ */
function attachHandlers(){
  document.querySelectorAll('[data-view]').forEach(function(el){
    el.onclick = function(){ state.view = el.getAttribute('data-view'); render(); };
  });
  document.querySelectorAll('[data-navgroup]').forEach(function(el){
    el.onclick = function(){
      var g = el.getAttribute('data-navgroup');
      if(groupOfView(state.view) !== g){ state.view = VIEW_GROUPS[g][0][0]; render(); }
    };
  });
  var gsubs = document.querySelectorAll('[data-gsub]');
  gsubs.forEach(function(el){ el.onclick = function(){
    state.grammarSub = el.getAttribute('data-gsub');
    if(state.grammarSub === 'practice') resetGrammarQueue();
    else if(state.grammarSub === 'cards') resetGrammarCardsQueue();
    render();
  }; });
  document.querySelectorAll('[data-gcardmode]').forEach(function(el){
    el.onclick = function(){ state.grammarCardMode = el.getAttribute('data-gcardmode'); clearRetryContext('gramcards'); rebuildGrammarCardsQuestion(); render(); };
  });
  document.querySelectorAll('[data-grefview]').forEach(function(el){
    el.onclick = function(){ state.grammarRefView = el.getAttribute('data-grefview'); render(); };
  });
  document.querySelectorAll('[data-refitem]').forEach(function(el){
    el.onclick = function(){
      var p = el.getAttribute('data-refitem');
      state.grammarExpanded[p] = !state.grammarExpanded[p];
      render();
    };
  });
  document.querySelectorAll('[data-topictoggle]').forEach(function(el){
    el.onclick = function(){
      var c = el.getAttribute('data-topictoggle');
      state.grammarTopicOpen[c] = !state.grammarTopicOpen[c];
      render();
    };
  });
  document.querySelectorAll('[data-lessontoggle]').forEach(function(el){
    el.onclick = function(){
      var l = el.getAttribute('data-lessontoggle');
      state.grammarLessonOpen[l] = !state.grammarLessonOpen[l];
      render();
    };
  });

  // words category filter
  var catToggle = document.getElementById('cat-toggle');
  if(catToggle) catToggle.onclick = function(){ state.wordsCatOpen = !state.wordsCatOpen; render(); };
  var catAll = document.getElementById('cat-all');
  if(catAll) catAll.onclick = function(){ state.wordsSelected = CATEGORIES.slice(); resetWordsQueue(); render(); };
  var catNone = document.getElementById('cat-none');
  if(catNone) catNone.onclick = function(){ state.wordsSelected = []; resetWordsQueue(); render(); };
  document.querySelectorAll('.cat-chip[data-cat]').forEach(function(el){
    el.onclick = function(){
      var c = el.getAttribute('data-cat');
      var i = state.wordsSelected.indexOf(c);
      if(i === -1) state.wordsSelected.push(c); else state.wordsSelected.splice(i,1);
      resetWordsQueue(); render();
    };
  });
  var wmodeToggle = document.getElementById('wmode-toggle');
  if(wmodeToggle) wmodeToggle.onclick = function(){ state.wordsModeOpen = !state.wordsModeOpen; render(); };
  var excludedToggle = document.getElementById('excluded-toggle');
  if(excludedToggle) excludedToggle.onclick = function(){ state.excludedPanelOpen = !state.excludedPanelOpen; render(); };
  var excludedPhToggle = document.getElementById('excluded-ph-toggle');
  if(excludedPhToggle) excludedPhToggle.onclick = function(){ state.excludedPhPanelOpen = !state.excludedPhPanelOpen; render(); };
  document.querySelectorAll('[data-restore]').forEach(function(el){
    el.onclick = function(){
      restoreWord(el.getAttribute('data-restore'));
      resetWordsQueue();
      resetPhrasesQueue();
      render();
    };
  });
  document.querySelectorAll('.cat-chip[data-wmode]').forEach(function(el){
    el.onclick = function(){
      state.wordsMode = el.getAttribute('data-wmode');
      state.wordsModeOpen = false;
      state.player.index = 0;
      clearRetryContext('words');
      rebuildStandaloneQuestion();
      render();
    };
  });
  var reshuffleW = document.getElementById('reshuffle-words');
  if(reshuffleW) reshuffleW.onclick = function(){
    var scoped = ALL_WORDS.filter(function(w){ return state.wordsSelected.indexOf(w.category) !== -1; });
    scoped.forEach(function(w){ delete state.progress[w.id]; });
    saveProgress();
    resetWordsQueue();
    render();
  };

  // phrases category filter
  var phcatToggle = document.getElementById('phcat-toggle');
  if(phcatToggle) phcatToggle.onclick = function(){ state.phrasesCatOpen = !state.phrasesCatOpen; render(); };
  var phcatAll = document.getElementById('phcat-all');
  if(phcatAll) phcatAll.onclick = function(){ state.phrasesSelected = PHRASE_CATEGORIES.slice(); resetPhrasesQueue(); render(); };
  var phcatNone = document.getElementById('phcat-none');
  if(phcatNone) phcatNone.onclick = function(){ state.phrasesSelected = []; resetPhrasesQueue(); render(); };
  document.querySelectorAll('.cat-chip[data-phcat]').forEach(function(el){
    el.onclick = function(){
      var c = el.getAttribute('data-phcat');
      var i = state.phrasesSelected.indexOf(c);
      if(i === -1) state.phrasesSelected.push(c); else state.phrasesSelected.splice(i,1);
      resetPhrasesQueue(); render();
    };
  });
  var phmodeToggle = document.getElementById('phmode-toggle');
  if(phmodeToggle) phmodeToggle.onclick = function(){ state.phrasesModeOpen = !state.phrasesModeOpen; render(); };
  document.querySelectorAll('.cat-chip[data-phmode]').forEach(function(el){
    el.onclick = function(){
      state.phrasesMode = el.getAttribute('data-phmode');
      state.phrasesModeOpen = false;
      state.player.phindex = 0;
      clearRetryContext('phrases');
      rebuildPhrasesQuestion();
      render();
    };
  });
  var reshufflePh = document.getElementById('reshuffle-phrases');
  if(reshufflePh) reshufflePh.onclick = function(){
    var scoped = ALL_PHRASES.filter(function(p){ return state.phrasesSelected.indexOf(p.category) !== -1; });
    scoped.forEach(function(p){ delete state.progress[p.id]; });
    saveProgress();
    resetPhrasesQueue();
    render();
  };

  // grammar category filter
  var gcatToggle = document.getElementById('gcat-toggle');
  if(gcatToggle) gcatToggle.onclick = function(){ state.grammarCatOpen = !state.grammarCatOpen; render(); };
  var gcatAll = document.getElementById('gcat-all');
  if(gcatAll) gcatAll.onclick = function(){
    state.grammarSelected = GRAMMAR_CATS.slice();
    if(state.grammarSub === 'cards') resetGrammarCardsQueue(); else resetGrammarQueue();
    render();
  };
  var gcatNone = document.getElementById('gcat-none');
  if(gcatNone) gcatNone.onclick = function(){
    state.grammarSelected = [];
    if(state.grammarSub === 'cards') resetGrammarCardsQueue(); else resetGrammarQueue();
    render();
  };
  document.querySelectorAll('.cat-chip[data-gcat]').forEach(function(el){
    el.onclick = function(){
      var c = el.getAttribute('data-gcat');
      var i = state.grammarSelected.indexOf(c);
      if(i === -1) state.grammarSelected.push(c); else state.grammarSelected.splice(i,1);
      if(state.grammarSub === 'practice'){ resetGrammarQueue(); }
      else if(state.grammarSub === 'cards'){ resetGrammarCardsQueue(); }
      render();
    };
  });
  var reshuffleG = document.getElementById('reshuffle-grammar');
  if(reshuffleG) reshuffleG.onclick = function(){ resetGrammarQueue(); render(); };
  var reshuffleGC = document.getElementById('reshuffle-gramcards');
  if(reshuffleGC) reshuffleGC.onclick = function(){ resetGrammarCardsQueue(); render(); };

  // exam sub-tabs
  document.querySelectorAll('.cat-chip[data-examsub]').forEach(function(el){
    el.onclick = function(){ state.examSub = el.getAttribute('data-examsub'); state.examSubOpen = false; resetExamQueue(); render(); };
  });
  var examsubToggle = document.getElementById('examsub-toggle');
  if(examsubToggle) examsubToggle.onclick = function(){ state.examSubOpen = !state.examSubOpen; render(); };
  var reshuffleE = document.getElementById('reshuffle-exam');
  if(reshuffleE) reshuffleE.onclick = function(){ resetExamQueue(); render(); };

  document.querySelectorAll('.cat-chip[data-mockstart]').forEach(function(el){
    el.onclick = function(){ startMockExam(el.getAttribute('data-mockstart')); render(); };
  });
  var mockQuit = document.getElementById('mock-quit');
  if(mockQuit) mockQuit.onclick = function(){ state.mockExam.phase = 'pick'; render(); };
  var mockRestart = document.getElementById('mock-restart');
  if(mockRestart) mockRestart.onclick = function(){ state.mockExam.phase = 'pick'; render(); };

  // qa sub-tabs
  document.querySelectorAll('.cat-chip[data-qasub]').forEach(function(el){
    el.onclick = function(){ state.qaSub = el.getAttribute('data-qasub'); state.qaSubOpen = false; resetQAQueue(); render(); };
  });
  var qasubToggle = document.getElementById('qasub-toggle');
  if(qasubToggle) qasubToggle.onclick = function(){ state.qaSubOpen = !state.qaSubOpen; render(); };
  var reshuffleQA = document.getElementById('reshuffle-qa');
  if(reshuffleQA) reshuffleQA.onclick = function(){ resetQAQueue(); render(); };

  // theme sub-tabs
  document.querySelectorAll('.cat-chip[data-themesub]').forEach(function(el){
    el.onclick = function(){ state.themeSub = el.getAttribute('data-themesub'); state.themeSubOpen = false; resetThemeQueue(); render(); };
  });
  var themesubToggle = document.getElementById('themesub-toggle');
  if(themesubToggle) themesubToggle.onclick = function(){ state.themeSubOpen = !state.themeSubOpen; render(); };
  document.querySelectorAll('[data-countermode]').forEach(function(el){
    el.onclick = function(){ state.themeCounterMode = el.getAttribute('data-countermode'); clearRetryContext('theme'); rebuildThemeQuestion(); render(); };
  });
  var reshuffleTheme = document.getElementById('reshuffle-theme');
  if(reshuffleTheme) reshuffleTheme.onclick = function(){ resetThemeQueue(); render(); };

  var searchInput = document.getElementById('search-input');
  if(searchInput){
    searchInput.oninput = function(){
      state.searchQuery = searchInput.value;
      var body = document.getElementById('search-results-body');
      if(body) body.innerHTML = renderSearchResultsBody();
    };
  }
  var aiPanelToggle = document.getElementById('ai-panel-toggle');
  if(aiPanelToggle) aiPanelToggle.onclick = function(){ state.aiPanelOpen = !state.aiPanelOpen; render(); };
  var aiInput = document.getElementById('ai-input');
  if(aiInput) aiInput.oninput = function(){ state.aiInput = aiInput.value; };
  var aiGenerate = document.getElementById('ai-generate');
  if(aiGenerate) aiGenerate.onclick = function(){ generateWordViaAI(); };
  var aiConfirm = document.getElementById('ai-confirm');
  if(aiConfirm) aiConfirm.onclick = function(){ confirmAddWord(); };
  var aiCancel = document.getElementById('ai-cancel');
  if(aiCancel) aiCancel.onclick = function(){ cancelAiPreview(); };
  document.querySelectorAll('[data-tap]').forEach(function(el){
    el.onclick = function(){ if(el.disabled) return; handleConstructTap(el.getAttribute('data-tap')); };
  });
  document.querySelectorAll('[data-remove]').forEach(function(el){
    el.onclick = function(){ handleConstructRemove(parseInt(el.getAttribute('data-remove'),10)); };
  });
  var conClear = document.getElementById('construct-clear');
  if(conClear) conClear.onclick = function(){ handleConstructClear(); };
  var conSubmit = document.getElementById('construct-submit');
  if(conSubmit) conSubmit.onclick = function(){ handleConstructSubmit(); };

  // session setup
  document.querySelectorAll('[data-sessmode]').forEach(function(el){
    el.onclick = function(){ state.session.mode = el.getAttribute('data-sessmode'); render(); };
  });
  document.querySelectorAll('[data-size]').forEach(function(el){
    el.onclick = function(){ state.session.size = parseInt(el.getAttribute('data-size'),10); render(); };
  });
  document.querySelectorAll('[data-ordermode]').forEach(function(el){
    el.onclick = function(){ state.session.orderMode = el.getAttribute('data-ordermode'); render(); };
  });
  var lessonToggle = document.getElementById('lesson-toggle');
  if(lessonToggle) lessonToggle.onclick = function(){ state.session.lessonOpen = !state.session.lessonOpen; render(); };
  var lessonAll = document.getElementById('lesson-all');
  if(lessonAll) lessonAll.onclick = function(){ state.session.lessonSelected = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]; render(); };
  var lessonNone = document.getElementById('lesson-none');
  if(lessonNone) lessonNone.onclick = function(){ state.session.lessonSelected = []; render(); };
  document.querySelectorAll('.cat-chip[data-lesson]').forEach(function(el){
    el.onclick = function(){
      var l = parseInt(el.getAttribute('data-lesson'),10);
      var i = state.session.lessonSelected.indexOf(l);
      if(i === -1) state.session.lessonSelected.push(l); else state.session.lessonSelected.splice(i,1);
      render();
    };
  });
  var sesscatToggle = document.getElementById('sesscat-toggle');
  if(sesscatToggle) sesscatToggle.onclick = function(){ state.session.catOpen = !state.session.catOpen; render(); };
  var sesscatAll = document.getElementById('sesscat-all');
  if(sesscatAll) sesscatAll.onclick = function(){ state.session.catSelected = CATEGORIES.slice(); render(); };
  var sesscatNone = document.getElementById('sesscat-none');
  if(sesscatNone) sesscatNone.onclick = function(){ state.session.catSelected = []; render(); };
  document.querySelectorAll('.cat-chip[data-sesscat]').forEach(function(el){
    el.onclick = function(){
      var c = el.getAttribute('data-sesscat');
      var i = state.session.catSelected.indexOf(c);
      if(i === -1) state.session.catSelected.push(c); else state.session.catSelected.splice(i,1);
      render();
    };
  });
  var startBtn = document.getElementById('start-session');
  if(startBtn) startBtn.onclick = function(){ startSession(); };
  var restartBtn = document.getElementById('restart-session');
  if(restartBtn) restartBtn.onclick = function(){ restartSessionSetup(); };
  var sessionBackBtn = document.getElementById('session-back-to-setup');
  if(sessionBackBtn) sessionBackBtn.onclick = function(){ restartSessionSetup(); };

  // card flip + rate
  var flipCard = document.getElementById('flip-card');
  if(flipCard) flipCard.onclick = function(){ handleFlip(); };
  var btnAgain = document.getElementById('btn-again');
  if(btnAgain) btnAgain.onclick = function(e){ e.stopPropagation(); handleCardRate('learning'); };
  var btnKnow = document.getElementById('btn-know');
  if(btnKnow) btnKnow.onclick = function(e){ e.stopPropagation(); handleCardRate('known'); };
  var gramCardAgain = document.getElementById('gram-card-again');
  if(gramCardAgain) gramCardAgain.onclick = function(e){ e.stopPropagation(); handleGrammarCardRate(false); };
  var gramCardKnow = document.getElementById('gram-card-know');
  if(gramCardKnow) gramCardKnow.onclick = function(e){ e.stopPropagation(); handleGrammarCardRate(true); };
  var excludeBtn = document.getElementById('exclude-word');
  if(excludeBtn) excludeBtn.onclick = function(e){ e.stopPropagation(); handleExcludeWord(); };

  // choice options (kr2ru, ru2kr, sentchoice, grammar)
  document.querySelectorAll('.opt[data-choice]').forEach(function(el){
    el.onclick = function(){ handleChoice(el.getAttribute('data-choice')); };
  });

  // typing (spell, senttype)
  var typeForm = document.getElementById('type-form');
  if(typeForm){
    var typeInput = document.getElementById('type-input');
    if(typeInput) typeInput.focus();
    typeForm.onsubmit = function(e){ e.preventDefault(); handleTypeSubmit(typeInput.value); };
  }
}

async function boot(){
  var files = ['data/words.json','data/grammar.json','data/grammar-exercises.json',
               'data/exam.json','data/qa.json','data/theme.json','data/phrases.json'];
  var results = await Promise.all(files.map(function(f){
    return fetch(f).then(function(r){ return r.json(); });
  }));
  RAW = results[0]; GRAMMAR_TOPICS = results[1]; GRAMMAR_EXERCISES = results[2];
  EXAM_DATA = results[3]; QA_DATA = results[4]; THEME_DATA = results[5]; PHRASES_RAW = results[6];
  THEME_DATA.numbers = buildNumberExercises();
  EXAM_DATA.listening = await fetch('data/local/listening.json')
    .then(function(r){ return r.ok ? r.json() : []; })
    .catch(function(){ return []; });
  EXAM_DATA.topikReading = await fetch('data/local/reading.json')
    .then(function(r){ return r.ok ? r.json() : []; })
    .catch(function(){ return []; });
  initData();
  initState();
  loadProgress();
}
boot();
})();
