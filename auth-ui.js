
(function(){
"use strict";

var ROOT_ID = 'auth-root';
var STYLE_ID = 'auth-ui-styles';
var LOGIN_RE = /^[\p{L}\p{N}_-]{3,32}$/u;

var state = {
  inited: false,
  mode: 'login', // 'login' | 'register'
  loading: false,
  error: '',
  showPass: false,
  showPass2: false,
  callbacks: { onLogin: function(){}, onRegister: function(){} }
};

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}

function injectStyles(){
  if(document.getElementById(STYLE_ID)) return;
  var css = ''
    + '#' + ROOT_ID + '{ min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px 14px; }'
    + '.auth-card{ width:100%; max-width:380px; }'
    + '.auth-title{ font-weight:900; font-size:19px; text-align:center; margin-bottom:18px; }'
    + '.auth-field{ margin-bottom:14px; }'
    + '.auth-field label{ display:block; font-size:12.5px; font-weight:600; color:var(--ink-soft); text-transform:uppercase; letter-spacing:0.6px; margin-bottom:6px; }'
    + '.auth-field input{ width:100%; padding:13px 14px; border-radius:12px; border:1.5px solid var(--line); font-size:16px; outline:none; background:var(--paper); color:var(--ink); }'
    + '.auth-field input:focus{ border-color:var(--ink); }'
    + '.auth-field input:disabled{ opacity:0.6; }'
    + '.auth-pass-wrap{ position:relative; }'
    + '.auth-pass-wrap input{ padding-right:44px; }'
    + '.auth-eye{ position:absolute; top:0; right:0; width:44px; height:100%; border:none; background:none; cursor:pointer; font-size:16px; color:var(--stone); display:flex; align-items:center; justify-content:center; }'
    + '.auth-eye:disabled{ cursor:default; opacity:0.5; }'
    + '.auth-submit{ width:100%; margin-top:6px; }'
    + '.auth-submit:disabled{ opacity:0.6; cursor:default; }'
    + '.auth-header{ display:grid; grid-template-columns:30px 1fr 30px; align-items:center; margin-bottom:18px; }'
    + '.auth-header .auth-title{ margin-bottom:0; }'
    + '.auth-back{ width:30px; height:30px; border:none; background:none; color:var(--stone); font-size:20px; line-height:1; cursor:pointer; justify-self:start; }'
    + '.auth-back:hover{ color:var(--ink); }'
    + '.auth-back:disabled{ opacity:0.5; cursor:default; }'
    + '@media (max-width:420px){ .auth-card{ max-width:100%; } }';
  var tag = document.createElement('style');
  tag.id = STYLE_ID;
  tag.textContent = css;
  document.head.appendChild(tag);
}

function getRoot(){ return document.getElementById(ROOT_ID); }

function currentFieldValues(){
  var u = document.getElementById('auth-username');
  var p = document.getElementById('auth-password');
  var p2 = document.getElementById('auth-password2');
  return { username: u ? u.value : '', password: p ? p.value : '', password2: p2 ? p2.value : '' };
}

function restoreFieldValues(vals){
  if(!vals) return;
  var u = document.getElementById('auth-username'); if(u) u.value = vals.username;
  var p = document.getElementById('auth-password'); if(p) p.value = vals.password;
  var p2 = document.getElementById('auth-password2'); if(p2) p2.value = vals.password2;
}

function setAppHidden(hidden){
  var app = document.getElementById('app');
  if(app) app.style.display = hidden ? 'none' : '';
}

function validate(username, password, password2){
  if(!LOGIN_RE.test(username)) return 'Логин: 3–32 символа, буквы, цифры, «_» и «-».';
  if(password.length < 8) return 'Пароль должен быть не короче 8 символов.';
  if(state.mode === 'register' && password !== password2) return 'Пароли не совпадают.';
  return '';
}

function render(preserve){
  var root = getRoot();
  if(!root) return;
  var vals = preserve !== false ? currentFieldValues() : null;
  var isLogin = state.mode === 'login';
  var html = '<div class="auth-card qcard">'
    + '<div class="auth-header">'
    +   '<button type="button" class="auth-back" id="auth-back" title="Продолжить без входа"' + (state.loading ? ' disabled' : '') + '>←</button>'
    +   '<div class="auth-title">' + (isLogin ? 'Вход' : 'Регистрация') + '</div>'
    +   '<span></span>'
    + '</div>'
    + '<div class="sub-toggle">'
    +   '<button type="button" data-authtab="login" class="' + (isLogin ? 'active' : '') + '"' + (state.loading ? ' disabled' : '') + '>Вход</button>'
    +   '<button type="button" data-authtab="register" class="' + (!isLogin ? 'active' : '') + '"' + (state.loading ? ' disabled' : '') + '>Регистрация</button>'
    + '</div>'
    + '<form id="auth-form" novalidate>'
    +   '<div class="auth-field">'
    +     '<label for="auth-username">Логин</label>'
    +     '<input id="auth-username" type="text" autocomplete="username" maxlength="32"' + (state.loading ? ' disabled' : '') + '>'
    +   '</div>'
    +   '<div class="auth-field">'
    +     '<label for="auth-password">Пароль</label>'
    +     '<div class="auth-pass-wrap">'
    +       '<input id="auth-password" type="' + (state.showPass ? 'text' : 'password') + '" autocomplete="' + (isLogin ? 'current-password' : 'new-password') + '"' + (state.loading ? ' disabled' : '') + '>'
    +       '<button type="button" class="auth-eye" data-eyetarget="auth-password"' + (state.loading ? ' disabled' : '') + '>' + (state.showPass ? '🙈' : '👁') + '</button>'
    +     '</div>'
    +   '</div>';
  if(!isLogin){
    html += '<div class="auth-field">'
      +     '<label for="auth-password2">Повторите пароль</label>'
      +     '<div class="auth-pass-wrap">'
      +       '<input id="auth-password2" type="' + (state.showPass2 ? 'text' : 'password') + '" autocomplete="new-password"' + (state.loading ? ' disabled' : '') + '>'
      +       '<button type="button" class="auth-eye" data-eyetarget="auth-password2"' + (state.loading ? ' disabled' : '') + '>' + (state.showPass2 ? '🙈' : '👁') + '</button>'
      +     '</div>'
      +   '</div>';
  }
  if(state.error){
    html += '<div class="feedback bad">' + esc(state.error) + '</div>';
  }
  html += '<button type="submit" class="btn btn-primary auth-submit"' + (state.loading ? ' disabled' : '') + '>'
    +   (state.loading ? (isLogin ? 'Входим…' : 'Регистрируем…') : (isLogin ? 'Войти' : 'Зарегистрироваться'))
    + '</button>'
    + '</form>'
    + '</div>';
  root.innerHTML = html;
  restoreFieldValues(vals);
  attach();
}

function attach(){
  var root = getRoot();
  if(!root) return;
  var back = document.getElementById('auth-back');
  if(back) back.onclick = function(){ if(!state.loading) window.AuthUI.hide(); };
  var tabs = root.querySelectorAll('[data-authtab]');
  for(var i=0; i<tabs.length; i++){
    tabs[i].onclick = function(){
      if(state.loading) return;
      state.mode = this.getAttribute('data-authtab');
      state.error = '';
      render(false);
    };
  }
  var eyes = root.querySelectorAll('[data-eyetarget]');
  for(var j=0; j<eyes.length; j++){
    eyes[j].onclick = function(){
      var target = this.getAttribute('data-eyetarget');
      if(target === 'auth-password') state.showPass = !state.showPass;
      else state.showPass2 = !state.showPass2;
      render();
    };
  }
  var form = document.getElementById('auth-form');
  if(form) form.onsubmit = function(e){
    e.preventDefault();
    if(state.loading) return;
    var username = (document.getElementById('auth-username') || {}).value || '';
    var password = (document.getElementById('auth-password') || {}).value || '';
    var password2Field = document.getElementById('auth-password2');
    var password2 = password2Field ? password2Field.value : '';
    username = username.trim();
    var err = validate(username, password, password2);
    if(err){ state.error = err; render(); return; }
    state.error = '';
    render();
    if(state.mode === 'login') state.callbacks.onLogin({ username: username, password: password });
    else state.callbacks.onRegister({ username: username, password: password });
  };
}

window.AuthUI = {
  init: function(opts){
    opts = opts || {};
    state.callbacks.onLogin = typeof opts.onLogin === 'function' ? opts.onLogin : function(){};
    state.callbacks.onRegister = typeof opts.onRegister === 'function' ? opts.onRegister : function(){};
    state.inited = true;
    injectStyles();
  },
  show: function(mode){
    if(!state.inited) window.AuthUI.init({});
    state.mode = (mode === 'register') ? 'register' : 'login';
    state.error = '';
    state.loading = false;
    var root = getRoot();
    if(root) root.style.display = '';
    setAppHidden(true);
    render();
  },
  hide: function(){
    var root = getRoot();
    if(root){ root.style.display = 'none'; root.innerHTML = ''; }
    setAppHidden(false);
  },
  setLoading: function(v){
    state.loading = !!v;
    render();
  },
  setError: function(message){
    state.error = message || '';
    render();
  },
  clearError: function(){
    state.error = '';
    render();
  }
};

if(location.search.indexOf('auth-preview=1') !== -1){
  document.addEventListener('DOMContentLoaded', function(){
    window.AuthUI.init({
      onLogin: function(data){ console.log('AuthUI preview: onLogin', data); },
      onRegister: function(data){ console.log('AuthUI preview: onRegister', data); }
    });
    window.AuthUI.show('login');
  });
}

})();
