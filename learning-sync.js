
(function(){
"use strict";

var LOGIN_RE = /^[\p{L}\p{N}_-]{3,32}$/u;
var STORAGE_KEY = 'progress-v2';
var EXCLUDED_KEY = 'excluded-v1';

var supabase = null;
var user = null;
var profile = null;
var reviewStates = {};
var sessionBuffer = {};
var readyResolve;
var readyPromise = new Promise(function(resolve){ readyResolve = resolve; });
var authListener = null;
var onAuthChangeCb = null;
var syncError = null;
var fsrsEngine = null;
var Rating = null;
var createEmptyCard = null;
var State = null;

function isConfigured(){
  var cfg = window.SUPABASE_CONFIG || {};
  return !!(cfg.url && cfg.anonKey);
}

function initFsrs(){
  if(!window.FSRS) return;
  var lib = window.FSRS;
  Rating = lib.Rating;
  createEmptyCard = lib.createEmptyCard;
  State = lib.State;
  fsrsEngine = lib.fsrs(lib.generatorParameters({ request_retention: 0.9 }));
}

function normalizeUsername(username){
  return String(username || '').normalize('NFKC').trim().toLowerCase();
}

async function sha256Hex(text){
  var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(function(b){
    return b.toString(16).padStart(2, '0');
  }).join('');
}

async function internalEmail(username){
  var normalized = normalizeUsername(username);
  var hex = await sha256Hex(normalized);
  return 'u_' + hex + '@users.invalid';
}

function parseItemKey(fullKey){
  if(!fullKey) return null;
  var idx = fullKey.indexOf(':');
  if(idx === -1) return null;
  return { itemType: fullKey.slice(0, idx), itemId: fullKey.slice(idx + 1), fullKey: fullKey };
}

function learningItemKey(question, ctx){
  if(!question) return null;
  ctx = ctx || {};
  if(question.word){
    if(String(question.word.id).indexOf('phrase::') === 0) return 'phrase:' + question.word.id;
    return 'word:' + question.word.id;
  }
  if(question.type === 'grammar' && question.ex){
    if(question.ex.pattern) return 'grammar:' + question.ex.pattern;
    if(question.ex.id) return 'grammar:' + question.ex.id;
  }
  if((question.type === 'gramcard' || question.type === 'gramspell') && question.item && question.item.pattern){
    return 'grammar:' + question.item.pattern;
  }
  if(question.item && (question.type === 'themecloze' || question.type === 'themedate')){
    var section = ctx.themeSub || 'theme';
    var groupKey = question.item.id || question.item.pattern || question.item.correct;
    if(groupKey) return 'theme:' + section + ':' + groupKey;
  }
  return null;
}

function isProgressQuestion(question){
  if(!question) return false;
  var skip = ['exread','exlisten','extopikread','exorder','excon','excloze','qword','qanswer','response'];
  return skip.indexOf(question.type) === -1;
}

function rowToCard(row){
  if(!row) return createEmptyCard(new Date());
  return {
    due: new Date(row.due_at),
    stability: row.stability || 0,
    difficulty: row.difficulty || 0,
    elapsed_days: row.elapsed_days || 0,
    scheduled_days: row.scheduled_days || 0,
    reps: row.reps || 0,
    lapses: row.lapses || 0,
    learning_steps: row.learning_steps || 0,
    state: row.fsrs_state || 0,
    last_review: row.last_review_at ? new Date(row.last_review_at) : undefined
  };
}

function cardToRow(parsed, card){
  var nowIso = new Date().toISOString();
  return {
    user_id: user.id,
    item_type: parsed.itemType,
    item_id: parsed.itemId,
    due_at: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    elapsed_days: card.elapsed_days,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learning_steps || 0,
    fsrs_state: card.state,
    last_review_at: card.last_review ? card.last_review.toISOString() : null,
    updated_at: nowIso
  };
}

function snapshotState(row){
  if(!row) return null;
  return {
    due_at: row.due_at,
    stability: row.stability,
    difficulty: row.difficulty,
    scheduled_days: row.scheduled_days,
    elapsed_days: row.elapsed_days,
    reps: row.reps,
    lapses: row.lapses,
    learning_steps: row.learning_steps,
    fsrs_state: row.fsrs_state,
    last_review_at: row.last_review_at
  };
}

function cacheRow(row){
  reviewStates[row.item_type + ':' + row.item_id] = row;
}

function getCachedRow(fullKey){
  var parsed = parseItemKey(fullKey);
  if(!parsed) return null;
  return reviewStates[parsed.itemType + ':' + parsed.itemId] || null;
}

function aggregateRating(attempts){
  if(!attempts || !attempts.length) return Rating.Good;
  var last = attempts[attempts.length - 1];
  if(!last.correct) return Rating.Again;
  for(var i = 0; i < attempts.length; i++){
    if(!attempts[i].correct) return Rating.Hard;
  }
  return Rating.Good;
}

function endOfTodayUtc(){
  var d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999);
}

function classifyRow(row, now){
  if(!row || !row.reps) return 'new';
  var dueMs = new Date(row.due_at).getTime();
  var nowMs = now.getTime();
  var weak = row.lapses > 0 || row.fsrs_state === 3 || (row.difficulty >= 7 && dueMs <= nowMs);
  if(weak) return 'weak';
  if(dueMs <= nowMs) return 'overdue';
  if(row.fsrs_state === 2 && dueMs > nowMs) return 'mastered';
  if(row.fsrs_state === 0 && !row.last_review_at) return 'new';
  return 'learning';
}

function sortCandidates(a, b, bucket){
  if(bucket === 'weak'){
    if(b.lapses !== a.lapses) return b.lapses - a.lapses;
    if(a.stability !== b.stability) return a.stability - b.stability;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  }
  if(bucket === 'overdue'){
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  }
  if(bucket === 'mastered'){
    var al = a.last_review_at ? new Date(a.last_review_at).getTime() : 0;
    var bl = b.last_review_at ? new Date(b.last_review_at).getTime() : 0;
    if(al !== bl) return al - bl;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  }
  return String(a._key).localeCompare(String(b._key));
}

function selectFromPool(pool, size, getKeyFn){
  if(!pool.length) return [];
  size = Math.min(size, pool.length);
  var now = new Date();
  var buckets = { weak: [], overdue: [], new: [], mastered: [], learning: [] };
  pool.forEach(function(item){
    var key = getKeyFn(item);
    var row = key ? getCachedRow(key) : null;
    var bucket = classifyRow(row, now);
    var entry = { item: item, row: row, _key: key || String(Math.random()) };
    if(buckets[bucket]) buckets[bucket].push(entry);
    else buckets.learning.push(entry);
  });
  ['weak','overdue','new','mastered','learning'].forEach(function(name){
    buckets[name].sort(function(a, b){ return sortCandidates(a.row || {}, b.row || {}, name); });
  });
  var selected = [];
  var seen = {};
  function take(list){
    for(var i = 0; i < list.length && selected.length < size; i++){
      var key = list[i]._key;
      if(seen[key]) continue;
      seen[key] = true;
      selected.push(list[i].item);
    }
  }
  take(buckets.weak);
  take(buckets.overdue);
  take(buckets.new);
  take(buckets.mastered);
  take(buckets.learning);
  return selected.slice(0, size);
}

function computeStats(pool, getKeyFn){
  var now = new Date();
  var endToday = endOfTodayUtc();
  var stats = { total: pool.length, newCount: 0, learning: 0, dueToday: 0, mastered: 0, nextDueAt: null };
  pool.forEach(function(item){
    var key = getKeyFn(item);
    var row = key ? getCachedRow(key) : null;
    var bucket = classifyRow(row, now);
    if(bucket === 'new') stats.newCount++;
    else if(bucket === 'mastered') stats.mastered++;
    else stats.learning++;
    if(row && new Date(row.due_at).getTime() <= endToday) stats.dueToday++;
    if(row && row.due_at){
      var dueMs = new Date(row.due_at).getTime();
      if(!stats.nextDueAt || dueMs < new Date(stats.nextDueAt).getTime()) stats.nextDueAt = row.due_at;
    }
  });
  return stats;
}

function mapAuthError(err){
  var msg = (err && err.message) ? err.message : 'Ошибка авторизации';
  if(/invalid login credentials/i.test(msg)) return 'Неверный логин или пароль';
  if(/user already registered/i.test(msg)) return 'Такой логин уже занят';
  if(/password/i.test(msg) && /short/i.test(msg)) return 'Пароль слишком короткий';
  if(/network|fetch/i.test(msg)) return 'Ошибка сети — локальный прогресс сохранён';
  return msg.replace(/email/gi, 'логин');
}

async function loadProfile(){
  if(!user) return null;
  var res = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
  if(res.error) throw res.error;
  profile = res.data;
  return profile;
}

async function loadReviewStates(itemTypes){
  if(!user) return;
  var query = supabase.from('review_states').select('*').eq('user_id', user.id);
  if(itemTypes && itemTypes.length) query = query.in('item_type', itemTypes);
  var res = await query;
  if(res.error) throw res.error;
  reviewStates = {};
  (res.data || []).forEach(cacheRow);
}

async function upsertReviewRow(row){
  var res = await supabase.from('review_states').upsert(row, {
    onConflict: 'user_id,item_type,item_id'
  });
  if(res.error) throw res.error;
  cacheRow(row);
}

async function insertReviewLogs(logs){
  if(!logs.length) return;
  var res = await supabase.from('review_logs').insert(logs);
  if(res.error) throw res.error;
}

async function applyFsrsUpdate(fullKey, rating, meta){
  if(!user || !fsrsEngine) return null;
  var parsed = parseItemKey(fullKey);
  if(!parsed) return null;
  meta = meta || {};
  var prevRow = getCachedRow(fullKey);
  var prevSnap = snapshotState(prevRow);
  var card = rowToCard(prevRow);
  var now = new Date();
  var result = fsrsEngine.next(card, now, rating);
  var nextRow = cardToRow(parsed, result.card);
  if(prevRow && prevRow.updated_at){
    var prevUpdated = new Date(prevRow.updated_at).getTime();
    var localUpdated = nextRow.updated_at ? new Date(nextRow.updated_at).getTime() : 0;
    if(prevUpdated > localUpdated) return prevRow;
  }
  if(!prevRow) nextRow.created_at = now.toISOString();
  await upsertReviewRow(nextRow);
  if(meta.logs && meta.logs.length){
    await insertReviewLogs(meta.logs.map(function(log){
      return {
        user_id: user.id,
        item_type: parsed.itemType,
        item_id: parsed.itemId,
        rating: log.rating,
        correct: log.correct,
        context: log.context || meta.context || null,
        response_ms: log.response_ms || null,
        reviewed_at: log.reviewed_at || now.toISOString(),
        previous_state: prevSnap,
        next_state: snapshotState(nextRow)
      };
    }));
  } else {
    await insertReviewLogs([{
      user_id: user.id,
      item_type: parsed.itemType,
      item_id: parsed.itemId,
      rating: rating,
      correct: meta.correct !== false,
      context: meta.context || null,
      response_ms: meta.response_ms || null,
      reviewed_at: now.toISOString(),
      previous_state: prevSnap,
      next_state: snapshotState(nextRow)
    }]);
  }
  return nextRow;
}

function localProgressFromRow(fullKey){
  var row = getCachedRow(fullKey);
  if(!row || !row.reps) return null;
  var bucket = classifyRow(row, new Date());
  if(bucket === 'mastered') return 'known';
  return 'learning';
}

function syncLocalProgressMap(progressMap){
  Object.keys(progressMap || {}).forEach(function(id){
    var fullKey = id.indexOf('phrase::') === 0 ? ('phrase:' + id) : ('word:' + id);
    var mapped = localProgressFromRow(fullKey);
    if(mapped) progressMap[id] = mapped;
  });
}

function hasLocalProgress(){
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(raw && Object.keys(JSON.parse(raw)).length) return true;
  }catch(e){}
  try{
    var ex = localStorage.getItem(EXCLUDED_KEY);
    if(ex && Object.keys(JSON.parse(ex)).length) return true;
  }catch(e){}
  return false;
}

function needsMigrationPrompt(){
  return !!(user && profile && !profile.progress_migrated_at && hasLocalProgress());
}

async function migrateLocalProgress(opts){
  opts = opts || {};
  if(!user) return;
  var progress = {};
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(raw) progress = JSON.parse(raw);
  }catch(e){}
  if(opts.mode === 'fresh'){
    await supabase.from('profiles').update({ progress_migrated_at: new Date().toISOString() }).eq('user_id', user.id);
    await loadProfile();
    return;
  }
  var now = new Date();
  for(var id in progress){
    if(!progress.hasOwnProperty(id)) continue;
    var fullKey = id.indexOf('phrase::') === 0 ? ('phrase:' + id) : ('word:' + id);
    var parsed = parseItemKey(fullKey);
    if(!parsed) continue;
    var rating = progress[id] === 'known' ? Rating.Good : Rating.Again;
    var card = createEmptyCard(now);
    var result = fsrsEngine.next(card, now, rating);
    var row = cardToRow(parsed, result.card);
    row.created_at = now.toISOString();
    await upsertReviewRow(row);
  }
  await supabase.from('profiles').update({ progress_migrated_at: now.toISOString() }).eq('user_id', user.id);
  await loadProfile();
  await loadReviewStates();
}

function clearSessionBuffer(){ sessionBuffer = {}; }

function recordSessionAttempt(fullKey, isCorrect, meta){
  if(!fullKey) return;
  meta = meta || {};
  if(!sessionBuffer[fullKey]){
    sessionBuffer[fullKey] = { attempts: [], logs: [], context: meta.context || 'session' };
  }
  var entry = sessionBuffer[fullKey];
  entry.attempts.push({ correct: !!isCorrect, at: Date.now() });
  entry.logs.push({
    rating: isCorrect ? Rating.Good : Rating.Again,
    correct: !!isCorrect,
    context: meta.context || 'session',
    response_ms: meta.response_ms || null,
    reviewed_at: new Date().toISOString()
  });
}

async function flushSessionReviews(){
  if(!user || !Object.keys(sessionBuffer).length) { clearSessionBuffer(); return; }
  var keys = Object.keys(sessionBuffer);
  for(var i = 0; i < keys.length; i++){
    var fullKey = keys[i];
    var buf = sessionBuffer[fullKey];
    var rating = aggregateRating(buf.attempts);
    try{
      await applyFsrsUpdate(fullKey, rating, { context: buf.context || 'session', logs: buf.logs });
    }catch(e){
      syncError = e;
      console.warn('FSRS sync failed:', e);
    }
  }
  clearSessionBuffer();
}

async function recordStandaloneReview(fullKey, isCorrect, meta){
  if(!user || !fullKey) return;
  meta = meta || {};
  var rating = isCorrect ? Rating.Good : Rating.Again;
  try{
    await applyFsrsUpdate(fullKey, rating, meta);
  }catch(e){
    syncError = e;
    console.warn('Review sync failed:', e);
  }
}

async function signUp(username, password){
  if(!LOGIN_RE.test(normalizeUsername(username))) throw new Error('Некорректный логин');
  var email = await internalEmail(username);
  var normalized = normalizeUsername(username);
  var res = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        username: username.trim(),
        username_normalized: normalized
      }
    }
  });
  if(res.error) throw new Error(mapAuthError(res.error));
  if(res.data && res.data.session) await handleSession(res.data.session);
  return res.data;
}

async function signIn(username, password){
  var email = await internalEmail(username);
  var res = await supabase.auth.signInWithPassword({ email: email, password: password });
  if(res.error) throw new Error(mapAuthError(res.error));
  if(res.data && res.data.session) await handleSession(res.data.session);
  return res.data;
}

async function signOut(){
  if(supabase) await supabase.auth.signOut();
  user = null;
  profile = null;
  reviewStates = {};
  clearSessionBuffer();
}

async function handleSession(session){
  user = session && session.user ? session.user : null;
  if(!user){
    profile = null;
    reviewStates = {};
    return null;
  }
  await loadProfile();
  await loadReviewStates();
  return { user: user, profile: profile };
}

async function init(){
  initFsrs();
  if(!isConfigured()){
    readyResolve();
    return { configured: false };
  }
  if(typeof supabase === 'undefined' && !window.supabase){
    console.warn('Supabase JS not loaded');
    readyResolve();
    return { configured: false };
  }
  var sbGlobal = window.supabase || supabase;
  supabase = sbGlobal.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  authListener = supabase.auth.onAuthStateChange(function(event, session){
    handleSession(session).then(function(){
      if(typeof onAuthChangeCb === 'function') onAuthChangeCb(event, session);
    });
  });
  var current = await supabase.auth.getSession();
  await handleSession(current.data.session);
  readyResolve();
  return { configured: true, session: current.data.session };
}

window.LearningSync = {
  ready: readyPromise,
  isConfigured: isConfigured,
  isLoggedIn: function(){ return !!user; },
  getUser: function(){ return user; },
  getProfile: function(){ return profile; },
  getSyncError: function(){ return syncError; },
  clearSyncError: function(){ syncError = null; },
  normalizeUsername: normalizeUsername,
  internalEmail: internalEmail,
  learningItemKey: learningItemKey,
  parseItemKey: parseItemKey,
  isProgressQuestion: isProgressQuestion,
  getReviewState: getCachedRow,
  getReviewStates: function(){ return reviewStates; },
  loadReviewStates: loadReviewStates,
  selectFromPool: selectFromPool,
  computeStats: computeStats,
  aggregateRating: aggregateRating,
  signUp: signUp,
  signIn: signIn,
  signOut: signOut,
  migrateLocalProgress: migrateLocalProgress,
  hasLocalProgress: hasLocalProgress,
  needsMigrationPrompt: needsMigrationPrompt,
  syncLocalProgressMap: syncLocalProgressMap,
  recordSessionAttempt: recordSessionAttempt,
  flushSessionReviews: flushSessionReviews,
  recordStandaloneReview: recordStandaloneReview,
  clearSessionBuffer: clearSessionBuffer,
  onAuthStateChange: function(cb){ onAuthChangeCb = cb; },
  classifyRow: classifyRow
};

init();

})();
