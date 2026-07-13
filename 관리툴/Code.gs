// 2030 안산 소모임 관리툴

// 최초 관리자(시드) — '운영자' 시트가 없을 때 기본으로 넣어주는 계정. 시트에서 제거 불가.
var ALLOWED_EMAILS = [
  'capshinsmg@gmail.com'
];

// 신원확인 담당 운영자 시드 — 실제 운영자 목록은 '운영자' 시트에서 관리(추가/삭제)
var OPERATORS = [
  { email: 'capshinsmg@gmail.com', name: '민규' }
];

var INQUIRY_KAKAO_URL = 'https://open.kakao.com/o/ssuPwLBi';

// ===== 운영자(로그인 권한 + 담당자) 관리 =====
// 운영자 시트: 이메일(0) 이름(1) 추가일(2) 코드(3)
function getOrCreateOperatorSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('운영자');
  if (!sheet) {
    sheet = ss.insertSheet('운영자');
    var h = ['이메일', '이름', '추가일', '코드', '배분'];
    var r = sheet.getRange(1, 1, 1, h.length);
    r.setValues([h]); r.setFontWeight('bold'); r.setBackground('#5b5bd6'); r.setFontColor('white');
    // 하드코딩된 시드 운영자를 최초 1회 채워넣음 (배분 기본 1)
    var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    OPERATORS.forEach(function(o) {
      sheet.appendRow([o.email, o.name, today, genOpCode_(), 1]);
    });
  } else {
    if (String(sheet.getRange(1, 4).getValue() || '').trim() !== '코드') {
      sheet.getRange(1, 4).setValue('코드');   // 구버전 시트에 접속코드 컬럼 추가
    }
    if (String(sheet.getRange(1, 5).getValue() || '').trim() !== '배분') {
      sheet.getRange(1, 5).setValue('배분').setFontWeight('bold').setBackground('#5b5bd6').setFontColor('white');   // 구버전 시트에 배분(가중치) 컬럼 추가
    }
  }
  return sheet;
}

// 운영자 접속코드 생성 (혼동되는 문자 0/O/1/I/L 제외한 6자리)
function genOpCode_() {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var s = '';
  for (var i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

// 시트에서 운영자 목록 조회 (코드 없는 기존 운영자는 자동 발급). 반환: {email,name,code}
function getOperators_() {
  var sheet = getOrCreateOperatorSheet_();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return OPERATORS.map(function(o) { return { email: o.email, name: o.name, code: '', weight: 1 }; });
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var email = String(data[i][0] || '').trim().toLowerCase();
    var name = String(data[i][1] || '').trim();
    if (!email && !name) continue;
    var code = String(data[i][3] || '').trim();
    if (!code) { code = genOpCode_(); sheet.getRange(i + 1, 4).setValue(code); }  // 코드 없는 기존 운영자 백필
    // 배분(가중치): 빈칸이면 기본 1, 명시적 0이면 자동배정 제외
    var raw = String(data[i][4] == null ? '' : data[i][4]).trim();
    var weight = raw === '' ? 1 : Math.max(0, Math.floor(Number(raw) || 0));
    out.push({ email: email, name: name, code: code, weight: weight });
  }
  return out;
}

// 로그인 허용 여부: 시드 계정 또는 운영자 시트에 등록된 이메일
function isAllowed_(email) {
  if (!email) return false;
  email = String(email).trim().toLowerCase();
  var seeded = ALLOWED_EMAILS.some(function(e) { return String(e).toLowerCase() === email; });
  if (seeded) return true;
  try {
    return getOperators_().some(function(o) { return o.email === email; });
  } catch (e) { return false; }
}

// 현재 접속자 이메일 — 구글이 이메일을 안 넘겨줄 때(다른 Gmail 계정)는 접속코드 세션에서 복원
function currentOperatorEmail_() {
  var email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (email) return email;
  try {
    var key = Session.getTemporaryActiveUserKey();
    if (key) {
      var cached = CacheService.getScriptCache().get('opauth_' + key);
      if (cached) return String(cached).trim().toLowerCase();
    }
  } catch (e) {}
  return '';
}

function checkAuth() {
  var email = currentOperatorEmail_();
  return { email: email, allowed: isAllowed_(email) };
}

// 접속코드 검증 — 유효하면 이 브라우저 세션을 해당 운영자로 인증(6시간 캐시)
function checkCode(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return { ok: false };
  var ops = getOperators_();
  var match = null;
  for (var i = 0; i < ops.length; i++) {
    if (ops[i].code && String(ops[i].code).toUpperCase() === code) { match = ops[i]; break; }
  }
  if (!match) return { ok: false };
  try {
    var key = Session.getTemporaryActiveUserKey();
    if (key) CacheService.getScriptCache().put('opauth_' + key, match.email, 21600);
  } catch (e) {}
  return { ok: true, name: match.name };
}

// 서버측 인증 가드 — 허용되지 않은 호출 차단
function requireAuth_() {
  if (!isAllowed_(currentOperatorEmail_())) {
    throw new Error('접근 권한이 없습니다.');
  }
}

function getOperators() {
  requireAuth_();
  return getOperators_();
}

// 운영자 추가 — 구글 이메일 입력 시 로그인 권한 + 담당자 선택지 자동 부여
function addOperator(email, name) {
  requireAuth_();
  email = String(email || '').trim().toLowerCase();
  name = String(name || '').trim();
  if (!email || email.indexOf('@') === -1) return { success: false, code: 'bad_email' };
  if (!name) return { success: false, code: 'no_name' };
  var sheet = getOrCreateOperatorSheet_();
  var data = sheet.getDataRange().getValues();
  var dup = data.slice(1).some(function(row) { return String(row[0] || '').trim().toLowerCase() === email; });
  if (dup) return { success: false, code: 'dup' };
  var newCode = genOpCode_();
  sheet.appendRow([email, name, Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'), newCode, 1]);
  return { success: true, newCode: newCode, operators: getOperators_() };
}

// 운영자별 배분(가중치) 설정 — 0=자동배정 제외, 1=기본, 2·3…=더 많이 받음
function setOperatorWeight(email, weight) {
  requireAuth_();
  email = String(email || '').trim().toLowerCase();
  var w = Math.max(0, Math.min(9, Math.floor(Number(weight) || 0)));
  var sheet = getOrCreateOperatorSheet_();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim().toLowerCase() === email) {
      sheet.getRange(i + 1, 5).setValue(w);
      return { success: true, operators: getOperators_() };
    }
  }
  return { success: false, code: 'not_found' };
}

// 운영자 제거 — 시드(하드코딩) 계정은 안전을 위해 제거 불가
function removeOperator(email) {
  requireAuth_();
  email = String(email || '').trim().toLowerCase();
  if (ALLOWED_EMAILS.some(function(e) { return String(e).toLowerCase() === email; })) {
    return { success: false, code: 'protected' };
  }
  var sheet = getOrCreateOperatorSheet_();
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0] || '').trim().toLowerCase() === email) sheet.deleteRow(i + 1);
  }
  return { success: true, operators: getOperators_() };
}

// ===== 텔레그램 알림 =====
// 토큰·채팅ID는 Script Properties에만 저장 (공개 저장소에 노출 방지)
function tgProps_() { return PropertiesService.getScriptProperties(); }

function tgApi_(token, method, payload) {
  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(payload || {}), muteHttpExceptions: true
  });
  try { return JSON.parse(res.getContentText()); } catch (e) { return { ok: false, description: '응답 파싱 실패' }; }
}

function getTelegramSettings() {
  requireAuth_();
  var p = tgProps_();
  return {
    tokenSaved: !!p.getProperty('tgToken'),
    chatId: p.getProperty('tgChatId') || '',
    enabled: p.getProperty('tgEnabled') === 'true'
  };
}

function saveTelegramSettings(token, chatId, enabled) {
  requireAuth_();
  var p = tgProps_();
  token = String(token || '').trim();
  if (token) p.setProperty('tgToken', token);   // 비워두면 기존 토큰 유지
  p.setProperty('tgChatId', String(chatId || '').trim());
  p.setProperty('tgEnabled', enabled ? 'true' : 'false');
  return { success: true };
}

// 그룹에서 봇에게 /start 등을 보낸 뒤 호출 → 최근 대화의 chat_id 감지
function telegramDetectChatId(tokenOverride) {
  requireAuth_();
  var token = String(tokenOverride || '').trim() || tgProps_().getProperty('tgToken') || '';
  if (!token) return { success: false, message: '봇 토큰을 먼저 입력해주세요' };
  var r = tgApi_(token, 'getUpdates', { limit: 50 });
  if (!r.ok) return { success: false, message: '텔레그램 오류: ' + (r.description || '토큰을 확인해주세요') };
  var found = null;
  (r.result || []).reverse().some(function(u) {
    var msg = u.message || u.channel_post || (u.my_chat_member && { chat: u.my_chat_member.chat });
    if (msg && msg.chat) { found = msg.chat; return true; }
    return false;
  });
  if (!found) return { success: false, message: '대화를 못 찾았어요. 그룹에서 /start 를 보낸 뒤 다시 시도해주세요' };
  return { success: true, chatId: String(found.id), title: found.title || found.username || found.first_name || '' };
}

function testTelegram(tokenOverride, chatOverride) {
  requireAuth_();
  var token = String(tokenOverride || '').trim() || tgProps_().getProperty('tgToken') || '';
  var chatId = String(chatOverride || '').trim() || tgProps_().getProperty('tgChatId') || '';
  if (!token || !chatId) return { success: false, message: '토큰과 채팅 ID를 입력해주세요' };
  var r = tgApi_(token, 'sendMessage', { chat_id: chatId, text: '🔔 소모임 관리툴 알림 테스트입니다. 이 메시지가 보이면 연동 성공!' });
  return r.ok ? { success: true } : { success: false, message: r.description || '발송 실패' };
}

// 이벤트 발생 시 운영진 텔레그램 그룹으로 발송 — 실패해도 본 기능은 계속 동작
function notifyTelegram_(text) {
  try {
    var p = tgProps_();
    if (p.getProperty('tgEnabled') !== 'true') return;
    var token = p.getProperty('tgToken'), chatId = p.getProperty('tgChatId');
    if (!token || !chatId) return;
    tgApi_(token, 'sendMessage', { chat_id: chatId, text: text, disable_web_page_preview: true });
  } catch (e) { /* 알림 실패 무시 */ }
}

function maskPhone_(p) {
  var d = normalizePhone_(p);
  if (d.length < 8) return d;
  return d.slice(0, 3) + '-****-' + d.slice(-4);
}

function fmtGasDate_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  return String(v);
}

function fmtKorDate_(s) {
  if (!s) return '';
  // 여러 회차는 ' / '로 이어붙여 저장 — 각각 포맷 후 다시 결합
  return String(s).split(' / ').map(function(part) {
    var m = part.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
    if (!m) return part;
    var days = ['일','월','화','수','목','금','토'];
    var dt = new Date(+m[1], +m[2]-1, +m[3], +(m[4]||0), +(m[5]||0));
    var result = (+m[2]) + '월 ' + (+m[3]) + '일(' + days[dt.getDay()] + ')';
    if (m[4]) result += ' ' + ('0'+m[4]).slice(-2) + ':' + m[5];
    return result;
  }).join(' / ');
}

// 장소 문자열을 설명/지도핀으로 분리 (보드 포맷과 동일: "설명\n장소명 주소 URL @위도,경도")
function parseLoc_(loc) {
  loc = String(loc || '');
  var lat = '', lng = '';
  var cm = loc.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (cm) { lat = cm[1]; lng = cm[2]; loc = loc.replace(cm[0], '').trim(); }
  var m = loc.match(/(https?:\/\/[^\s)]+)/);
  if (!m) return { desc: loc.trim(), mapName: '', mapUrl: '', lat: lat, lng: lng };
  var url = m[1];
  var descLines = [], mapLine = '';
  loc.split('\n').forEach(function(ln) {
    if (ln.indexOf(url) >= 0) mapLine = ln; else descLines.push(ln);
  });
  var mapName = mapLine.replace(url, '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  var desc = descLines.join('\n').trim();
  if (!desc) desc = mapName;   // 구버전(설명 없이 장소만) 호환
  return { desc: desc, mapName: mapName, mapUrl: url, lat: lat, lng: lng };
}

function getShortUrl(longUrl) {
  requireAuth_();
  try {
    var res = UrlFetchApp.fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(longUrl), {muteHttpExceptions: true});
    var short = res.getContentText().trim();
    return short.indexOf('http') === 0 ? short : longUrl;
  } catch (e) { return longUrl; }
}

function doGet(e) {
  const params = e ? e.parameter : {};
  // 공개 홈페이지용 JSON API — 모집중(승인된) 모임만 반환
  if (params && params.api === 'events') {
    const events = getEvents_()
      .filter(function(ev) { return ev.status === '모집중'; })
      .map(function(ev) {
        const cnt = countApproved_(ev.name);
        return {
          name: ev.name,
          korDate: fmtKorDate_(ev.date),
          location: ev.location,
          leader: ev.leader,
          description: ev.description,
          max: ev.maxMembers ? Number(ev.maxMembers) : 0,
          count: cnt
        };
      });
    return ContentService.createTextOutput(JSON.stringify({ success: true, events: events, kakao: INQUIRY_KAKAO_URL }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // 내 신청 확인 — 이름+연락처가 모두 일치하는 본인 신청만 반환, 톡방 링크는 '승인' 상태일 때만 노출
  if (params && params.api === 'mystatus') {
    const name = String(params.name || '').replace(/\s/g, '');
    const phone = normalizePhone_(params.phone || '');
    let apps = [];
    if (name && phone) {
      const evByName = {};
      getEvents_().forEach(function(ev) { evByName[ev.name] = ev; });
      const sheet = getSheet('모임신청대기');
      if (sheet) {
        const data = sheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][2] || '').replace(/\s/g, '') !== name) continue;
          if (normalizePhone_(String(data[i][3] || '')) !== phone) continue;
          var evName = String(data[i][1] || '');
          var status = String(data[i][4] || '대기중');
          var ev = evByName[evName];
          apps.push({
            eventName: evName,
            korDate: ev ? fmtKorDate_(ev.date) : '',
            status: status,
            chatLink: (status === '승인' && ev) ? String(ev.chatLink || '') : '',
            chatCode: (status === '승인' && ev) ? String(ev.chatCode || '') : ''
          });
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, apps: apps }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (params && params.apply) {
    return HtmlService.createHtmlOutput(buildApplyPage(decodeURIComponent(params.apply)))
      .setTitle('모임 신청')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (params && params.page === 'board') {
    return HtmlService.createHtmlOutput(buildBoardPage())
      .setTitle('2030 안산 소모임')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('2030 안산 소모임 관리툴')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getWebAppUrl() {
  requireAuth_();
  return ScriptApp.getService().getUrl();
}

// 공개 홈페이지에서 오는 신청 처리 (text/plain JSON body — CORS preflight 회피)
function doPost(e) {
  let out = { success: false, code: 'error' };
  try {
    const req = JSON.parse(e.postData.contents);
    if (req.action === 'apply') out = submitBoardApplication(req);
    else if (req.action === 'leader') out = submitBoardLeaderApp(req);
    else out = { success: false, code: 'bad_action' };
  } catch (err) {
    out = { success: false, code: 'error' };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildApplyPage(eventName) {
  const events = getEvents_();
  const ev = events.find(e => e.name === eventName);
  if (!ev || ev.status === '완료') {
    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;text-align:center;padding:60px 20px;background:#f0f0f5}</style></head><body><div style="font-size:48px;margin-bottom:16px">😢</div><div style="font-size:18px;font-weight:600;color:#333">찾을 수 없거나 마감된 모임입니다.</div></body></html>`;
  }
  const safe = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const js = s => String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
  const loc = parseLoc_(ev.location);
  const locDescHtml = safe(loc.desc || '장소').replace(/\n/g, '<br>');
  const descHtml = ev.description ? safe(ev.description).replace(/\n/g, '<br>') : '';
  const KAKAO_JS_KEY = 'a036955b82c468791e2fff0ad47f5d75';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safe(ev.name)} - 모임 신청</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f0f0f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border-radius:20px;padding:28px 24px;max-width:400px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.1)}
.badge{display:inline-block;background:#ede9ff;color:#5b5bd6;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;margin-bottom:14px}
h1{font-size:20px;font-weight:700;color:#222;margin-bottom:18px;line-height:1.4}
.info{background:#f8f8fc;border-radius:12px;padding:14px;margin-bottom:22px}
.info-row{display:flex;gap:8px;margin-bottom:8px;font-size:13px;color:#555;align-items:flex-start}
.info-row:last-child{margin-bottom:0}
label{display:block;font-size:12px;color:#666;font-weight:500;margin-bottom:5px;margin-top:14px}
input{width:100%;padding:11px 14px;border:1.5px solid #e5e5e5;border-radius:10px;font-size:14px;outline:none;font-family:inherit}
input:focus{border-color:#5b5bd6}
button{width:100%;margin-top:20px;padding:14px;background:#5b5bd6;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}
button:disabled{background:#aaa;cursor:not-allowed}
.err{color:#e03131;font-size:12px;text-align:center;margin-top:10px;display:none}
.done{text-align:center;padding:20px 0;display:none}
.done-icon{font-size:56px;margin-bottom:14px}
.done-title{font-size:18px;font-weight:700;color:#333;margin-bottom:8px}
.done-sub{font-size:13px;color:#888;line-height:1.6}
.maplink{color:#5b5bd6;text-decoration:none;font-weight:600;white-space:nowrap}
#applymap{display:none;width:100%;height:180px;border-radius:12px;margin:0 0 18px;border:1px solid #e5e5e5;overflow:hidden}
.dsec{font-size:12px;font-weight:700;color:#5b5bd6;margin:0 0 7px}
.ddesc{font-size:13.5px;color:#333;line-height:1.7;white-space:pre-wrap;background:#f8f8fc;border-radius:12px;padding:13px;margin-bottom:20px}
</style>
</head>
<body>
<div class="card">
  <div id="fv">
    <div class="badge">📅 모임 신청</div>
    <h1>${safe(ev.name)}</h1>
    <div class="info">
      <div class="info-row"><span>📅</span><span>${fmtKorDate_(ev.date)}</span></div>
      <div class="info-row"><span>📍</span><span>${locDescHtml}${loc.mapUrl ? ' <a class="maplink" href="' + safe(loc.mapUrl) + '" target="_blank" rel="noopener">🗺️ 지도</a>' : ''}</span></div>
      ${ev.leader ? '<div class="info-row"><span>👤</span><span>리더: ' + safe(ev.leader) + '</span></div>' : ''}
    </div>
    <div id="applymap"></div>
    ${descHtml ? '<div class="dsec">📝 모임 소개</div><div class="ddesc">' + descHtml + '</div>' : ''}
    <label>이름 *</label>
    <input id="nm" type="text" placeholder="홍길동" maxlength="20">
    <label>연락처 *</label>
    <input id="ph" type="tel" placeholder="010-0000-0000" maxlength="13">
    <button id="sb" onclick="go()">신청하기</button>
    <div id="er" class="err"></div>
  </div>
  <div id="dv" class="done">
    <div class="done-icon">🎉</div>
    <div class="done-title">신청이 완료됐어요!</div>
    <div class="done-sub">운영진 승인 후 홈페이지의<br><b>📋 내 신청 확인</b>에서 톡방 링크를 확인할 수 있어요 😊</div>
  </div>
</div>
<script>
function go(){
  var n=document.getElementById('nm').value.trim();
  var p=document.getElementById('ph').value.trim();
  var er=document.getElementById('er');
  er.style.display='none';
  if(!n||!p){er.textContent='이름과 연락처를 입력해주세요';er.style.display='block';return;}
  var btn=document.getElementById('sb');
  btn.disabled=true;btn.textContent='신청 중...';
  google.script.run
    .withSuccessHandler(function(r){
      if(r.success){document.getElementById('fv').style.display='none';document.getElementById('dv').style.display='block';}
      else if(r.message==='already'){er.textContent='이미 신청하셨어요! 운영진 확인을 기다려주세요.';er.style.display='block';btn.disabled=false;btn.textContent='신청하기';}
      else{er.textContent='오류가 발생했어요. 다시 시도해주세요.';er.style.display='block';btn.disabled=false;btn.textContent='신청하기';}
    })
    .withFailureHandler(function(){er.textContent='오류가 발생했어요. 다시 시도해주세요.';er.style.display='block';btn.disabled=false;btn.textContent='신청하기';})
    .submitEventApplication({eventName:'${js(ev.name)}',name:n,phone:p});
}
// 지도핀이 있는 모임만 카카오 지도 인라인 표시 (SDK 도메인 미등록 시 링크로 대체)
var MAP_LAT='${loc.lat || ''}', MAP_LNG='${loc.lng || ''}';
var MAP_Q = '${js(loc.mapName || '')}';
var MAP_KEY = '${KAKAO_JS_KEY}';
function drawApplyMap(lat,lng){
  if(!lat||!lng) return;
  var el=document.getElementById('applymap'); el.style.display='block';
  var pos=new kakao.maps.LatLng(lat,lng);
  var map=new kakao.maps.Map(el,{center:pos,level:3});
  new kakao.maps.Marker({position:pos,map:map});
  setTimeout(function(){ map.relayout(); map.setCenter(pos); },0);
}
if(((MAP_LAT&&MAP_LNG)||MAP_Q) && MAP_KEY){
  var ks=document.createElement('script');
  ks.src='https://dapi.kakao.com/v2/maps/sdk.js?appkey='+MAP_KEY+'&libraries=services&autoload=false';
  ks.onload=function(){
    if(!window.kakao||!kakao.maps) return;
    kakao.maps.load(function(){
      if(MAP_LAT&&MAP_LNG){ drawApplyMap(parseFloat(MAP_LAT),parseFloat(MAP_LNG)); return; }
      var svc=new kakao.maps.services.Places();
      svc.keywordSearch(MAP_Q, function(data,status){
        if(status!==kakao.maps.services.Status.OK||!data.length) return;
        drawApplyMap(parseFloat(data[0].y),parseFloat(data[0].x));
      });
    });
  };
  document.head.appendChild(ks);
}
</script>
</body>
</html>`;
}

// ===== 모임신청 (공개 신청 페이지) =====
function submitEventApplication(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('모임신청대기');
  if (!sheet) {
    sheet = ss.insertSheet('모임신청대기');
    const h = ['타임스탬프', '모임명', '이름', '연락처', '처리상태'];
    const r = sheet.getRange(1, 1, 1, h.length);
    r.setValues([h]); r.setFontWeight('bold'); r.setBackground('#5b5bd6'); r.setFontColor('white');
  }
  const existing = sheet.getDataRange().getValues();
  // 취소·거절된 이전 신청은 무시 → 실수로 취소돼도 다시 신청 가능
  const isDup = existing.slice(1).some(row =>
    String(row[1]) === data.eventName &&
    normalizePhone_(row[3]) === normalizePhone_(data.phone) &&
    ['취소', '거절'].indexOf(String(row[4])) === -1);
  if (isDup) return { success: false, message: 'already' };
  sheet.appendRow([Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), data.eventName, data.name, normalizePhone_(data.phone), '대기중']);
  notifyTelegram_('📝 모임 신청 접수\n• 모임: ' + data.eventName + '\n• 신청자: ' + data.name + ' (' + maskPhone_(data.phone) + ')\n관리툴 → 모임 관리 → 신청자 관리에서 승인해주세요');
  return { success: true };
}

function getEventApplicants(eventName) {
  requireAuth_();
  const sheet = getSheet('모임신청대기');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1)
    .map((row, i) => ({ id: i + 2, eventName: String(row[1]||''), name: String(row[2]||''), phone: normalizePhone_(String(row[3]||'')), status: String(row[4]||'대기중') }))
    .filter(r => r.eventName === eventName);
}

function getAllApplicants() {
  requireAuth_();
  const sheet = getSheet('모임신청대기');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map((row, i) => ({ id: i + 2, eventName: String(row[1]||''), name: String(row[2]||''), phone: normalizePhone_(String(row[3]||'')), status: String(row[4]||'대기중') }));
}

function updateApplicantStatus(rowId, status) {
  requireAuth_();
  getSheet('모임신청대기').getRange(rowId, 5).setValue(status);
  return { success: true };
}

// ===== 공개 모임 보드 (?page=board) =====
// 이름+전화번호로 등록 회원 여부 검증 (전화번호는 정규화 후 비교)
function verifyMember_(name, phone) {
  const np = normalizePhone_(phone);
  if (!np || !name) return { ok: false, code: 'not_member' };
  const m = getMembers_().find(function(x) { return normalizePhone_(x.phone) === np; });
  if (!m || m.name.replace(/\s/g, '') !== String(name).replace(/\s/g, '')) {
    return { ok: false, code: 'not_member' };
  }
  if (m.status === '제재') return { ok: false, code: 'restricted' };
  return { ok: true, member: m };
}

function submitBoardApplication(data) {
  const v = verifyMember_(data.name, data.phone);
  if (!v.ok) return { success: false, code: v.code };
  const ev = getEvents_().find(function(e) { return e.name === data.eventName; });
  if (!ev || ev.status !== '모집중') return { success: false, code: 'closed' };
  if (ev.maxMembers && Number(ev.maxMembers) > 0) {
    const cnt = countApproved_(ev.name);
    if (cnt >= Number(ev.maxMembers)) return { success: false, code: 'full' };
  }
  const res = submitEventApplication({ eventName: data.eventName, name: v.member.name, phone: v.member.phone });
  if (!res.success) return { success: false, code: 'already' };
  return { success: true };
}

function submitBoardLeaderApp(data) {
  const v = verifyMember_(data.name, data.phone);
  if (!v.ok) return { success: false, code: v.code };
  if (!data.eventName || !data.category || !data.date1 || !data.location || !data.intro) {
    return { success: false, code: 'missing' };
  }
  // 오픈채팅 링크: 있으면 형식 검증 (빈 값은 레거시 경로 호환으로 허용 — 홈페이지 폼에선 필수)
  const chatLink = String(data.chatLink || '').trim();
  if (chatLink && chatLink.indexOf('open.kakao.com') === -1) {
    return { success: false, code: 'bad_link' };
  }
  // 입장 비밀번호: 있으면 4자 + 단순번호 차단 (홈페이지 폼에선 필수)
  const chatCode = String(data.chatCode || '').trim();
  if (chatCode && (chatCode.length !== 4 || chatCode === '1234' || /^(.)\1{3}$/.test(chatCode))) {
    return { success: false, code: 'bad_code' };
  }
  const leaderSheet = getOrCreateLeaderSheet_();
  leaderSheet.appendRow([
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    v.member.name, v.member.phone,
    data.eventName, data.category,
    data.date1 || '', data.date2 || '', data.date3 || '',
    data.location, data.maxMembers || '', data.intro, data.materials || '',
    '대기중', chatLink, chatCode
  ]);
  setTextCell_(leaderSheet.getRange(leaderSheet.getLastRow(), 15), chatCode);  // 입장코드 앞자리 0 보존
  notifyTelegram_('💡 새 리더 신청\n• 모임: ' + data.eventName + ' (' + data.category + ')\n• 리더: ' + v.member.name + '\n• 1회차: ' + fmtKorDate_(data.date1) + (chatLink ? '\n• 톡방 링크 제출됨 ✅' : '') + '\n관리툴 → 리더신청에서 승인해주세요');
  return { success: true };
}

function buildBoardPage() {
  const safe = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const js = s => String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
  const events = getEvents_().filter(e => e.status === '모집중');

  const cardsHtml = events.length ? events.map(e => {
    const cnt = countApproved_(e.name);
    const max = e.maxMembers ? Number(e.maxMembers) : 0;
    const full = max > 0 && cnt >= max;
    const cap = max ? cnt + '/' + max + '명' : cnt + '명 참여';
    return `
      <div class="ecard">
        <div class="ec-top">
          <span class="pill${full ? ' pfull' : ''}">${full ? '정원마감' : '모집중'}</span>
          <span class="ec-cap">👥 ${cap}</span>
        </div>
        <div class="ec-name">${safe(e.name)}</div>
        <div class="ec-meta">
          <span>📅 ${safe(fmtKorDate_(e.date))}</span>
          <span>📍 ${safe(e.location || '-')}</span>
          ${e.leader ? '<span>⭐ 리더 ' + safe(e.leader) + '</span>' : ''}
        </div>
        ${full
          ? '<button class="ec-btn dis" disabled>정원이 가득 찼어요</button>'
          : `<button class="ec-btn" onclick="openApply('${js(e.name)}')">신청하기</button>`}
      </div>`;
  }).join('') : `
      <div class="nores">
        <div style="font-size:40px;margin-bottom:10px">🌱</div>
        지금은 모집중인 모임이 없어요.<br>곧 새로운 모임이 열릴 예정이에요!
      </div>`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>2030 안산 소모임</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif;background:#f2f2f8;color:#222;padding-bottom:90px}
.hero{background:linear-gradient(135deg,#5b5bd6 0%,#8b7cf6 100%);padding:30px 20px 26px;color:#fff}
.hero-in{max-width:560px;margin:0 auto}
.hero .hb{display:inline-block;background:rgba(255,255,255,.2);font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:10px;letter-spacing:.5px}
.hero h1{font-size:24px;font-weight:800}
.hero p{font-size:13px;opacity:.85;margin-top:6px;line-height:1.5}
.wrap{max-width:560px;margin:0 auto;padding:18px 16px 0}
.sec{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;margin:6px 0 12px}
.sec .n{background:#ede9ff;color:#5b5bd6;font-size:12px;font-weight:700;padding:2px 9px;border-radius:12px}
.ecard{background:#fff;border-radius:16px;padding:18px;margin-bottom:12px;box-shadow:0 2px 12px rgba(91,91,214,.07)}
.ec-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.pill{background:#d3f9d8;color:#2f9e44;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px}
.pill.pfull{background:#f1f1f5;color:#999}
.ec-cap{font-size:12px;color:#888;font-weight:600}
.ec-name{font-size:17px;font-weight:700;margin-bottom:8px}
.ec-meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:#666;margin-bottom:14px;line-height:1.6}
.ec-btn{width:100%;padding:12px;background:#5b5bd6;color:#fff;border:none;border-radius:11px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}
.ec-btn:active{background:#4949c4}
.ec-btn.dis{background:#e3e3ea;color:#999;cursor:default}
.nores{background:#fff;border-radius:16px;padding:44px 20px;text-align:center;color:#888;font-size:13.5px;line-height:1.7}
.leader-cta{display:flex;align-items:center;gap:12px;background:#fff;border:1.5px dashed #b9b0f0;border-radius:16px;padding:16px;margin-top:18px;cursor:pointer}
.leader-cta .em{font-size:26px}
.leader-cta b{font-size:14px;display:block;margin-bottom:2px}
.leader-cta span{font-size:12px;color:#888}
.leader-cta .ar{margin-left:auto;color:#b0b0c0;font-size:20px}
.fab{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#FEE500;color:#3c1e1e;font-size:13.5px;font-weight:700;padding:12px 22px;border-radius:26px;text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:50}
.foot{max-width:560px;margin:22px auto 0;padding:0 16px;text-align:center;font-size:11.5px;color:#aaa;line-height:1.7}
.ov{position:fixed;inset:0;background:rgba(20,20,40,.5);z-index:100;display:none;align-items:flex-end;justify-content:center}
.ov.open{display:flex}
.sheet{background:#fff;width:100%;max-width:560px;border-radius:20px 20px 0 0;padding:14px 20px 30px;max-height:88vh;overflow-y:auto}
.sh-grab{width:40px;height:4px;background:#e0e0e8;border-radius:2px;margin:0 auto 16px}
.sh-title{font-size:17px;font-weight:800;margin-bottom:4px}
.sh-event{font-size:13px;color:#5b5bd6;font-weight:700;margin-bottom:10px}
label{display:block;font-size:12px;font-weight:600;color:#666;margin:12px 0 5px}
.in{width:100%;padding:12px 14px;border:1.5px solid #e5e5ec;border-radius:10px;font-size:14px;outline:none;font-family:inherit;background:#fff}
.in:focus{border-color:#5b5bd6}
textarea.in{height:84px;resize:none;line-height:1.5}
.row2{display:flex;gap:8px}
.row2>div{flex:1}
.errbox{display:none;background:#fff5f5;border:1px solid #ffd6d6;color:#c92a2a;font-size:13px;border-radius:10px;padding:12px;margin-top:14px;text-align:center;line-height:1.6}
.errbox.show{display:block}
.apply-note{background:#fff8e1;border:1px solid #ffe08a;color:#8a6d1a;font-size:12px;line-height:1.65;border-radius:10px;padding:11px 13px;margin-top:14px}
.apply-note b{font-weight:700}
.kbtn{display:inline-block;margin-top:8px;background:#FEE500;color:#3c1e1e;font-size:12.5px;font-weight:700;padding:8px 16px;border-radius:8px;text-decoration:none}
.sbtn{width:100%;margin-top:16px;padding:14px;background:#5b5bd6;color:#fff;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit}
.sbtn:disabled{background:#a9a9d0}
.done{text-align:center;padding:16px 0 4px}
.done-i{font-size:52px;margin-bottom:12px}
.done-t{font-size:16px;font-weight:800;margin-bottom:6px}
.done-s{font-size:13px;color:#888;margin-bottom:18px;line-height:1.6}
</style>
</head>
<body>

<div class="hero">
  <div class="hero-in">
    <div class="hb">2030 안산</div>
    <h1>소모임 🏠</h1>
    <p>안산 2030 청년들의 취미·친목 모임 플랫폼<br>마음에 드는 모임에 바로 신청해보세요!</p>
  </div>
</div>

<div class="wrap">
  <div class="sec">🔥 모집중인 모임 <span class="n">${events.length}</span></div>
  ${cardsHtml}
  <div class="leader-cta" onclick="openLeader()">
    <div class="em">💡</div>
    <div><b>열고 싶은 모임이 있나요?</b><span>리더가 되어 직접 모임을 만들어보세요</span></div>
    <div class="ar">›</div>
  </div>
</div>

<div class="foot">신청은 가입 회원만 가능해요.<br>아직 회원이 아니라면 오픈채팅으로 문의해주세요 💬</div>

<a class="fab" href="${INQUIRY_KAKAO_URL}" target="_blank">💬 문의하기</a>

<div class="ov" id="ov" onclick="if(event.target===this)closeSheet()">
  <div class="sheet">
    <div class="sh-grab"></div>

    <div id="f-apply" style="display:none">
      <div class="sh-title">모임 신청</div>
      <div class="sh-event" id="apply-event-name"></div>
      <label>이름</label>
      <input class="in" id="a-name" placeholder="가입 시 이름">
      <label>연락처</label>
      <input class="in" id="a-phone" type="tel" placeholder="01012345678">
      <div class="apply-note">
        ⚠️ 이 모임은 <b>전 회차 참석 조건</b>이에요. 모든 회차에 참석 가능한 경우에만 신청해 주세요.<br>
        🔒 신청 시 입력하신 <b>이름·연락처가 모임 리더에게 전달</b>돼요.
      </div>
      <div class="errbox" id="a-err"></div>
      <button class="sbtn" id="a-btn" onclick="submitApply()">신청하기</button>
    </div>

    <div id="f-leader" style="display:none">
      <div class="sh-title">💡 리더로 모임 만들기</div>
      <div class="sh-event">운영진 승인 후 모임이 오픈돼요</div>
      <div class="row2">
        <div><label>이름 *</label><input class="in" id="l-name" placeholder="가입 시 이름"></div>
        <div><label>연락처 *</label><input class="in" id="l-phone" type="tel" placeholder="01012345678"></div>
      </div>
      <label>모임명 *</label>
      <input class="in" id="l-ename" placeholder="예: 주말 보드게임 원정대">
      <label>분야 *</label>
      <input class="in" id="l-cat" placeholder="예: 운동, 보드게임, 맛집탐방">
      <label>1회차 일시 *</label>
      <input class="in" id="l-d1" type="datetime-local">
      <div class="row2">
        <div><label>2회차 (선택)</label><input class="in" id="l-d2" type="datetime-local"></div>
        <div><label>3회차 (선택)</label><input class="in" id="l-d3" type="datetime-local"></div>
      </div>
      <div class="row2">
        <div><label>장소 *</label><input class="in" id="l-loc" placeholder="예: 중앙동 OO카페"></div>
        <div><label>최대 인원 *</label><input class="in" id="l-max" type="number" min="2" placeholder="8"></div>
      </div>
      <label>모임 소개 *</label>
      <textarea class="in" id="l-intro" placeholder="어떤 모임인지 간단히 소개해주세요"></textarea>
      <label>준비물 (선택)</label>
      <input class="in" id="l-mat" placeholder="예: 운동화, 개인 물병">
      <div class="errbox" id="l-err"></div>
      <button class="sbtn" id="l-btn" onclick="submitLeader()">리더 신청하기</button>
    </div>

  </div>
</div>

<script>
var KAKAO = '${INQUIRY_KAKAO_URL}';
var curEvent = '';

function openApply(name){
  curEvent = name;
  document.getElementById('apply-event-name').textContent = name;
  document.getElementById('f-apply').style.display='block';
  document.getElementById('f-leader').style.display='none';
  prefill('a'); hideErr('a-err');
  document.getElementById('ov').classList.add('open');
}
function openLeader(){
  document.getElementById('f-apply').style.display='none';
  document.getElementById('f-leader').style.display='block';
  prefill('l'); hideErr('l-err');
  document.getElementById('ov').classList.add('open');
}
function closeSheet(){ document.getElementById('ov').classList.remove('open'); }
function prefill(p){
  try{
    var n=localStorage.getItem('sm_name'), ph=localStorage.getItem('sm_phone');
    if(n && !document.getElementById(p+'-name').value) document.getElementById(p+'-name').value=n;
    if(ph && !document.getElementById(p+'-phone').value) document.getElementById(p+'-phone').value=ph;
  }catch(e){}
}
function saveMe(n,p){ try{ localStorage.setItem('sm_name',n); localStorage.setItem('sm_phone',p); }catch(e){} }
function v(id){ return document.getElementById(id).value.trim(); }
function hideErr(id){ var el=document.getElementById(id); el.classList.remove('show'); el.innerHTML=''; }
function showErr(id, code){ var el=document.getElementById(id); el.innerHTML=errHtml(code); el.classList.add('show'); }
function errHtml(code){
  if(code==='not_member') return '<b>등록된 회원이 아닙니다.</b><br>문의 부탁드립니다.<br><a class="kbtn" href="'+KAKAO+'" target="_blank">💬 카카오톡 문의하기</a>';
  if(code==='restricted') return '현재 모임 신청이 제한된 상태예요.<br><a class="kbtn" href="'+KAKAO+'" target="_blank">💬 카카오톡 문의하기</a>';
  if(code==='already') return '이미 이 모임에 신청하셨어요 😊';
  if(code==='full') return '아쉽지만 정원이 가득 찼어요 😢';
  if(code==='closed') return '이미 마감된 모임이에요.';
  if(code==='missing') return '필수 항목을 모두 입력해주세요.';
  return '오류가 발생했어요. 잠시 후 다시 시도해주세요.';
}
function showDone(boxId, title){
  document.getElementById(boxId).innerHTML =
    '<div class="done"><div class="done-i">🎉</div><div class="done-t">'+title+'</div>'+
    '<div class="done-s">운영진 확인 후 오픈채팅으로 안내드릴게요.</div>'+
    '<button class="sbtn" onclick="location.reload()">확인</button></div>';
}
function submitApply(){
  var n=v('a-name'), p=v('a-phone');
  hideErr('a-err');
  if(!n||!p){ showErr('a-err','missing'); return; }
  var btn=document.getElementById('a-btn'); btn.disabled=true; btn.textContent='신청 중...';
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false; btn.textContent='신청하기';
      if(r.success){ saveMe(n,p); showDone('f-apply','신청이 완료됐어요!'); }
      else showErr('a-err', r.code);
    })
    .withFailureHandler(function(){ btn.disabled=false; btn.textContent='신청하기'; showErr('a-err','error'); })
    .submitBoardApplication({eventName:curEvent, name:n, phone:p});
}
function submitLeader(){
  var d={ name:v('l-name'), phone:v('l-phone'), eventName:v('l-ename'), category:v('l-cat'),
          date1:v('l-d1'), date2:v('l-d2'), date3:v('l-d3'),
          location:v('l-loc'), maxMembers:v('l-max'), intro:v('l-intro'), materials:v('l-mat') };
  hideErr('l-err');
  if(!d.name||!d.phone||!d.eventName||!d.category||!d.date1||!d.location||!d.maxMembers||!d.intro){ showErr('l-err','missing'); return; }
  var btn=document.getElementById('l-btn'); btn.disabled=true; btn.textContent='제출 중...';
  google.script.run
    .withSuccessHandler(function(r){
      btn.disabled=false; btn.textContent='리더 신청하기';
      if(r.success){ saveMe(d.name,d.phone); showDone('f-leader','리더 신청이 접수됐어요!'); }
      else showErr('l-err', r.code);
    })
    .withFailureHandler(function(){ btn.disabled=false; btn.textContent='리더 신청하기'; showErr('l-err','error'); })
    .submitBoardLeaderApp(d);
}
</script>
</body>
</html>`;
}

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

// ===== 시트 초기화 =====
function initSheets() {
  requireAuth_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = {
    '회원목록': ['이름', '나이', '성별', '연락처', '거주지', '관심분야', '가입일', '상태'],
    '모임목록': ['모임명', '날짜', '장소', '최대인원', '리더', '상태'],
    '신청현황': ['회원명', '모임명', '신청일', '출석여부'],
    '제재기록': ['회원명', '사유', '날짜', '처리결과'],
    '가입신청': ['타임스탬프', '이름', '나이', '성별', '연락처', '거주지역', '관심분야', '가입동기', '동의여부', '처리상태'],
    '리더신청': ['타임스탬프', '이름', '연락처', '모임명', '분야', '1회차', '2회차', '3회차', '장소', '최대인원', '모임소개', '준비물', '처리상태'],
    '모임신청대기': ['타임스탬프', '모임명', '이름', '연락처', '처리상태']
  };
  Object.entries(config).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      const range = sheet.getRange(1, 1, 1, headers.length);
      range.setValues([headers]);
      range.setFontWeight('bold');
      range.setBackground('#5b5bd6');
      range.setFontColor('white');
    }
  });
  return { success: true };
}

// ===== 회원 관리 =====
// 회원목록 컬럼: 이름(0) 나이(1) 성별(2) 연락처(3) 거주지(4) 관심분야(5) 가입일(6) 상태(7)

// 전화번호 정규화: 010을 10으로 입력하는 구글폼 오류 보정
function normalizePhone_(p) {
  if (!p) return '';
  var digits = String(p).replace(/\D/g, '');
  // 10자리이고 1로 시작하면 (예: 1012345678) → 앞에 0 추가
  if (digits.length === 10 && digits.charAt(0) === '1') digits = '0' + digits;
  return digits;
}

function getMembers() {
  requireAuth_();
  return getMembers_();
}

// 성별 정규화: 남자/남성/남/M → '남', 여자/여성/여/F → '여'. 애매(둘다/없음)하면 원본 유지
function normalizeGender_(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  var hasM = s.indexOf('남') >= 0, hasF = s.indexOf('여') >= 0;
  if (hasM && !hasF) return '남';
  if (hasF && !hasM) return '여';
  var low = s.toLowerCase();
  if (/female|woman|^f$/.test(low)) return '여';   // female이 male을 포함하므로 여성 먼저 판별
  if (/male|\bman\b|^m$/.test(low)) return '남';
  return s;
}

// 나이 정규화: '27세'·'27살'·'만27' → 27, 4자리 출생연도·'97년생' → 만나이 계산. 애매하면 원본
function normalizeAge_(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  var CUR = new Date().getFullYear();
  var yearMark = /년\s*생|생년/.test(s);
  var m = s.match(/\d{1,4}/);
  if (!m) return s;
  var n = parseInt(m[0], 10);
  if (n >= 1940 && n <= CUR - 5) return String(CUR - n);          // 1997 → 나이
  if (yearMark && n < 100) {                                       // 97년생 → 나이
    var by = (n <= (CUR % 100)) ? 2000 + n : 1900 + n;
    return String(CUR - by);
  }
  if (n >= 10 && n <= 99) return String(n);                        // 27, 27세, 27살
  return s;
}

function getMembers_() {
  const sheet = getSheet('회원목록');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map((row, i) => ({
    id: i + 2,
    name: String(row[0] || ''),
    age: normalizeAge_(String(row[1] || '')),
    gender: normalizeGender_(String(row[2] || '')),
    phone: normalizePhone_(String(row[3] || '')),
    location: String(row[4] || ''),
    hobby: String(row[5] || ''),
    joinDate: row[6] ? (row[6] instanceof Date ? Utilities.formatDate(row[6], 'Asia/Seoul', 'yyyy-MM-dd') : String(row[6])) : '',
    status: String(row[7] || '활성'),
    flagged: row[8] === true || String(row[8]).toUpperCase() === 'TRUE',
    note: String(row[9] || '')
  }));
}

// 이름 변경 시 모든 시트의 이름 참조를 동기화 (리더명, 신청 내역, 경고/제재 이력 등)
function syncMemberNameChange_(oldName, newName) {
  const targets = [
    { name: '모임목록',     col: 5 },  // 리더
    { name: '신청현황',     col: 1 },  // 회원명
    { name: '리더신청',     col: 2 },  // 이름
    { name: '모임신청대기', col: 3 },  // 이름
    { name: '제재기록',     col: 1 },  // 회원명
    { name: '경고이력',     col: 2 }   // 회원이름
  ];
  let total = 0;
  targets.forEach(function(t) {
    const sheet = getSheet(t.name);
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    data.slice(1).forEach(function(row, i) {
      if (String(row[t.col - 1]) === oldName) {
        sheet.getRange(i + 2, t.col).setValue(newName);
        total++;
      }
    });
  });
  return total;
}

function updateMember(rowId, data) {
  requireAuth_();
  const sheet = getSheet('회원목록');
  const oldName = String(sheet.getRange(rowId, 1).getValue() || '');
  sheet.getRange(rowId, 1, 1, 8).setValues([[
    data.name, data.age, data.gender, normalizePhone_(data.phone),
    data.location, data.hobby, data.joinDate, data.status
  ]]);
  // 특이사항(10열) 저장 — 지인여부(9열)는 건드리지 않음
  if (data.note !== undefined) {
    if (String(sheet.getRange(1, 9).getValue() || '').trim() !== '지인여부') {
      sheet.getRange(1, 9).setValue('지인여부').setFontWeight('bold').setBackground('#5b5bd6').setFontColor('white');
    }
    if (String(sheet.getRange(1, 10).getValue() || '').trim() !== '특이사항') {
      sheet.getRange(1, 10).setValue('특이사항').setFontWeight('bold').setBackground('#5b5bd6').setFontColor('white');
    }
    sheet.getRange(rowId, 10).setValue(String(data.note || ''));
  }
  let synced = 0;
  if (oldName && data.name && oldName !== data.name) {
    synced = syncMemberNameChange_(oldName, data.name);
  }
  return { success: true, synced: synced };
}

function toggleMemberFlag(rowId, flag) {
  requireAuth_();
  const sheet = getSheet('회원목록');
  if (sheet.getLastColumn() < 9) {
    sheet.getRange(1, 9).setValue('지인여부').setFontWeight('bold').setBackground('#5b5bd6').setFontColor('white');
  }
  sheet.getRange(rowId, 9).setValue(flag);
  return { success: true };
}

function addMember(data) {
  requireAuth_();
  getSheet('회원목록').appendRow([
    data.name, data.age, data.gender, normalizePhone_(data.phone),
    data.location, data.hobby,
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'),
    '활성'
  ]);
  return { success: true };
}

function updateMemberStatus(rowId, status) {
  requireAuth_();
  getSheet('회원목록').getRange(rowId, 8).setValue(status);
  return { success: true };
}

// ===== 모임 관리 =====
function getEvents() {
  requireAuth_();
  return getEvents_();
}

function getEvents_() {
  const sheet = getSheet('모임목록');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map((row, i) => ({
    id: i + 2,
    name: String(row[0] || ''),
    date: fmtGasDate_(row[1]),
    location: String(row[2] || ''),
    maxMembers: row[3],
    leader: String(row[4] || ''),
    status: String(row[5] || '모집중'),
    description: String(row[6] || ''),
    chatLink: String(row[7] || ''),
    chatCode: String(row[8] || '')
  }));
}

// 모임목록 7번째 열(소개) 헤더 보장
function ensureEventDescCol_() {
  const sheet = getSheet('모임목록');
  if (String(sheet.getRange(1, 7).getValue()) !== '소개') {
    sheet.getRange(1, 7).setValue('소개').setFontWeight('bold').setBackground('#5b5bd6').setFontColor('white');
  }
}

// 앞자리 0 보존: 셀을 텍스트(@) 형식으로 지정한 뒤 문자열로 기록 (0123이 123으로 변환되는 것 방지)
function setTextCell_(range, val) {
  range.setNumberFormat('@').setValue(String(val == null ? '' : val));
}

// 모임목록 8번째 열(톡방링크)·9번째 열(입장코드) 헤더 보장
function ensureEventChatCol_() {
  const sheet = getSheet('모임목록');
  if (String(sheet.getRange(1, 8).getValue()) !== '톡방링크') {
    sheet.getRange(1, 8).setValue('톡방링크').setFontWeight('bold').setBackground('#5b5bd6').setFontColor('white');
  }
  if (String(sheet.getRange(1, 9).getValue()) !== '입장코드') {
    sheet.getRange(1, 9).setValue('입장코드').setFontWeight('bold').setBackground('#5b5bd6').setFontColor('white');
  }
  // 입장코드 앞자리 0 보존: 데이터 영역을 텍스트 형식으로 강제
  if (sheet.getMaxRows() > 1) sheet.getRange(2, 9, sheet.getMaxRows() - 1, 1).setNumberFormat('@');
}

function addEvent(data) {
  requireAuth_();
  ensureEventDescCol_();
  ensureEventChatCol_();
  const evSheet = getSheet('모임목록');
  evSheet.appendRow([
    data.name, data.date, data.location, data.maxMembers, data.leader, '모집중', data.description || '', String(data.chatLink || '').trim(), String(data.chatCode || '').trim()
  ]);
  setTextCell_(evSheet.getRange(evSheet.getLastRow(), 9), String(data.chatCode || '').trim());  // 입장코드 앞자리 0 보존
  return { success: true };
}

function updateEventStatus(rowId, status) {
  requireAuth_();
  getSheet('모임목록').getRange(rowId, 6).setValue(status);
  return { success: true };
}

function updateEvent(rowId, data) {
  requireAuth_();
  const sheet = getSheet('모임목록');
  const oldName = String(sheet.getRange(rowId, 1).getValue() || '');
  sheet.getRange(rowId, 1, 1, 5).setValues([[
    data.name, data.date, data.location, data.maxMembers, data.leader
  ]]);
  if (data.description !== undefined) {
    ensureEventDescCol_();
    sheet.getRange(rowId, 7).setValue(data.description);
  }
  if (data.chatLink !== undefined) {
    ensureEventChatCol_();
    sheet.getRange(rowId, 8).setValue(String(data.chatLink || '').trim());
  }
  if (data.chatCode !== undefined) {
    ensureEventChatCol_();
    setTextCell_(sheet.getRange(rowId, 9), String(data.chatCode || '').trim());  // 입장코드 앞자리 0 보존
  }
  // 모임명 변경 시 신청 내역의 모임명도 동기화
  if (oldName && data.name && oldName !== data.name) {
    ['신청현황', '모임신청대기'].forEach(function(sn) {
      const s = getSheet(sn);
      if (!s) return;
      const d = s.getDataRange().getValues();
      d.slice(1).forEach(function(row, i) {
        if (String(row[1]) === oldName) s.getRange(i + 2, 2).setValue(data.name);
      });
    });
  }
  return { success: true };
}

function deleteEvent(rowId) {
  requireAuth_();
  const sheet = getSheet('모임목록');
  const name = String(sheet.getRange(rowId, 1).getValue() || '');
  sheet.deleteRow(rowId);
  // 연결된 신청 내역도 함께 삭제 (아래에서부터 지워 행 밀림 방지)
  let removed = 0;
  ['신청현황', '모임신청대기'].forEach(function(sn) {
    const s = getSheet(sn);
    if (!s) return;
    const d = s.getDataRange().getValues();
    for (var i = d.length - 1; i >= 1; i--) {
      if (String(d[i][1]) === name) { s.deleteRow(i + 1); removed++; }
    }
  });
  return { success: true, removed: removed };
}

function deleteRegistration(rowId) {
  requireAuth_();
  getSheet('신청현황').deleteRow(rowId);
  return { success: true };
}

// ===== 신청 현황 =====
function getRegistrations() {
  requireAuth_();
  return getRegistrations_();
}

function getRegistrations_() {
  const sheet = getSheet('신청현황');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map((row, i) => ({
    id: i + 2,
    memberName: String(row[0] || ''),
    eventName: String(row[1] || ''),
    applyDate: String(row[2] || ''),
    attendance: String(row[3] || '미출석')
  }));
}

// 승인된 참여 인원 수 — 모임신청대기 '승인' + 신청현황(확정 등록), 이름 기준 중복 제거
// (홈페이지 'N명 참여중' 표시와 정원마감 판정에 공통 사용)
function countApproved_(eventName) {
  var seen = {};
  var waitSheet = getSheet('모임신청대기');
  if (waitSheet) {
    var wd = waitSheet.getDataRange().getValues();
    for (var i = 1; i < wd.length; i++) {
      if (String(wd[i][1]) === eventName && String(wd[i][4]) === '승인') {
        seen[String(wd[i][2]).replace(/\s/g, '')] = true;
      }
    }
  }
  var regSheet = getSheet('신청현황');
  if (regSheet) {
    var rd = regSheet.getDataRange().getValues();
    for (var j = 1; j < rd.length; j++) {
      if (String(rd[j][1]) === eventName) {
        seen[String(rd[j][0]).replace(/\s/g, '')] = true;
      }
    }
  }
  return Object.keys(seen).length;
}

// 대기중 신청 수 (자동 완료 알림용)
function countPending_(eventName) {
  var s = getSheet('모임신청대기');
  if (!s) return 0;
  var d = s.getDataRange().getValues(), n = 0;
  for (var i = 1; i < d.length; i++) {
    if (String(d[i][1]) === eventName && String(d[i][4]) === '대기중') n++;
  }
  return n;
}

// ===== 모임 상태 자동 전환 =====
// 모임 날짜 문자열에서 회차별 Date 추출 ("yyyy-MM-dd HH:mm / yyyy-MM-dd HH:mm ..." 형태)
function parseEventDates_(s) {
  var out = [];
  var re = /(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/g, m;
  s = String(s || '');
  while ((m = re.exec(s))) {
    out.push(new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)));
  }
  return out;
}

// 시간 경과에 따른 상태 자동 전환 (30분 트리거 + 관리툴 접속 시 실행)
// - 모집중: 첫 회차 시작 시각이 지나면 → 승인 인원 0명이면 '완료', 있으면 '진행중'
// - 진행중: 마지막 회차 날짜가 지나면(다음날 0시부터) → '완료'
function autoUpdateEventStatuses() {
  var sheet = getSheet('모임목록');
  if (!sheet) return { success: false, changes: [] };
  var data = sheet.getDataRange().getValues();
  var now = new Date();
  var changes = [];
  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][0] || '');
    if (!name) continue;
    var status = String(data[i][5] || '모집중');
    if (status === '완료') continue;
    var dates = parseEventDates_(fmtGasDate_(data[i][1]));
    if (!dates.length) continue;
    var first = dates[0], last = dates[0];
    dates.forEach(function(d) { if (d < first) first = d; if (d > last) last = d; });
    var lastDayEnd = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);   // 마지막 회차 다음날 0시
    var next = status, note = '';
    if (status === '모집중' && now >= first) {
      if (countApproved_(name) === 0) {
        next = '완료';
        var pend = countPending_(name);
        note = pend ? ' (승인 0명·대기 ' + pend + '명 있음)' : ' (신청 0명)';
      } else {
        next = '진행중';
      }
    }
    if (next === '진행중' && now >= lastDayEnd) next = '완료';
    if (next !== status) {
      sheet.getRange(i + 1, 6).setValue(next);
      changes.push('• ' + name + ': ' + status + ' → ' + next + note);
    }
  }
  if (changes.length) notifyTelegram_('⏱ 모임 상태 자동 변경\n' + changes.join('\n'));
  return { success: true, changes: changes };
}

// 30분 주기 트리거 자동 설치 (관리툴 접속 시 확인) + 즉시 1회 실행해 화면과 시트를 맞춤
function ensureAutoStatusTrigger() {
  requireAuth_();
  var installed = false;
  var exists = ScriptApp.getProjectTriggers().some(function(t) {
    return t.getHandlerFunction() === 'autoUpdateEventStatuses';
  });
  if (!exists) {
    ScriptApp.newTrigger('autoUpdateEventStatuses').timeBased().everyMinutes(30).create();
    installed = true;
  }
  var r = autoUpdateEventStatuses();
  return { success: true, installed: installed, changes: r.changes || [] };
}

function addRegistration(data) {
  requireAuth_();
  const isDuplicate = checkDuplicate(data.memberName);
  if (isDuplicate) {
    return { success: false, message: '이미 진행중인 모임에 신청된 회원입니다.' };
  }
  getSheet('신청현황').appendRow([
    data.memberName, data.eventName,
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'),
    '미출석'
  ]);
  return { success: true };
}

function checkDuplicate(memberName) {
  requireAuth_();
  const events = getEvents_();
  const registrations = getRegistrations_();
  const activeEventNames = events
    .filter(e => e.status === '모집중' || e.status === '진행중')
    .map(e => e.name);
  return registrations.some(r =>
    r.memberName === memberName &&
    activeEventNames.includes(r.eventName) &&
    r.attendance !== '출석'
  );
}

function markAttendance(rowId, status) {
  requireAuth_();
  getSheet('신청현황').getRange(rowId, 4).setValue(status);
  return { success: true };
}

// ===== 제재 기록 =====
function getSanctions() {
  requireAuth_();
  const sheet = getSheet('제재기록');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map((row, i) => ({
    id: i + 2,
    memberName: String(row[0] || ''),
    reason: String(row[1] || ''),
    date: String(row[2] || ''),
    result: String(row[3] || '')
  }));
}

function addSanction(data) {
  requireAuth_();
  getSheet('제재기록').appendRow([
    data.memberName, data.reason,
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'),
    data.result
  ]);
  const members = getMembers_();
  const member = members.find(m => m.name === data.memberName);
  if (member) updateMemberStatus(member.id, '제재');
  return { success: true };
}

// ===== 가입신청 관리 =====
// 가입신청 컬럼: 타임스탬프(0) 이름(1) 나이(2) 성별(3) 연락처(4) 거주지역(5) 관심분야(6) 가입동기(7) 동의여부(8) 처리상태(9) 담당자(10) 신원확인(11)
function getApplications() {
  requireAuth_();
  const sheet = getSheet('가입신청');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map((row, i) => ({
    id: i + 2,
    timestamp: String(row[0] || ''),
    name: String(row[1] || ''),
    age: normalizeAge_(String(row[2] || '')),
    gender: normalizeGender_(String(row[3] || '')),
    phone: normalizePhone_(String(row[4] || '')),
    location: String(row[5] || ''),
    hobby: String(row[6] || ''),
    motivation: String(row[7] || ''),
    consent: String(row[8] || ''),
    status: String(row[9] || '대기중'),
    assignee: String(row[10] || ''),
    verify: String(row[11] || '미확인')
  }));
}

function ensureAppExtraCols_(sheet) {
  if (String(sheet.getRange(1, 11).getValue()) !== '담당자') {
    sheet.getRange(1, 11).setValue('담당자').setFontWeight('bold').setBackground('#5b5bd6').setFontColor('white');
  }
  if (String(sheet.getRange(1, 12).getValue()) !== '신원확인') {
    sheet.getRange(1, 12).setValue('신원확인').setFontWeight('bold').setBackground('#5b5bd6').setFontColor('white');
  }
}

function setAppAssignee(rowId, name) {
  requireAuth_();
  const sheet = getSheet('가입신청');
  ensureAppExtraCols_(sheet);
  sheet.getRange(rowId, 11).setValue(name);
  return { success: true };
}

function setAppVerifyStatus(rowId, status) {
  requireAuth_();
  const sheet = getSheet('가입신청');
  ensureAppExtraCols_(sheet);
  sheet.getRange(rowId, 12).setValue(status);
  return { success: true };
}

// 미배정 대기중 신청을 운영자들에게 라운드로빈 분배
function autoAssignApps() {
  requireAuth_();
  return autoAssignCore_();
}

// 내부용 — 가입신청 폼 트리거에서도 호출 (트리거 컨텍스트는 requireAuth_ 불가)
function autoAssignCore_() {
  const sheet = getSheet('가입신청');
  if (!sheet) return { success: false, count: 0 };
  ensureAppExtraCols_(sheet);
  const data = sheet.getDataRange().getValues();
  // 배분(가중치) 0인 운영자는 자동배정 대상에서 제외
  const ops = getOperators_().filter(function(o) { return o.weight > 0; });
  const names = ops.map(function(o) { return o.name; });
  if (!names.length) return { success: false, count: 0 };
  const weight = {};
  ops.forEach(function(o) { weight[o.name] = o.weight; });
  // 기존 배정 건수를 세서 가중치 대비 적게 가진 운영자부터 이어서 분배
  const counts = {};
  names.forEach(function(n) { counts[n] = 0; });
  data.slice(1).forEach(function(row) {
    const a = String(row[10] || '');
    if (counts.hasOwnProperty(a)) counts[a]++;
  });
  let assigned = 0;
  data.slice(1).forEach(function(row, i) {
    if (String(row[9] || '대기중') !== '대기중') return;
    if (String(row[10] || '')) return;
    // count/weight 비율이 가장 낮은 운영자에게 배정 (가중치 높을수록 더 많이 받음)
    const next = names.slice().sort(function(a, b) {
      return (counts[a] / weight[a]) - (counts[b] / weight[b]);
    })[0];
    sheet.getRange(i + 2, 11).setValue(next);
    counts[next]++;
    assigned++;
  });
  return { success: true, count: assigned };
}

function approveApplication(rowId) {
  requireAuth_();
  const sheet = getSheet('가입신청');
  const row = sheet.getRange(rowId, 1, 1, 10).getValues()[0];
  getSheet('회원목록').appendRow([
    row[1], row[2], row[3], normalizePhone_(row[4]), row[5], row[6],
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'),
    '활성'
  ]);
  sheet.getRange(rowId, 10).setValue('승인');
  return { success: true };
}

function bulkApproveApplications(rowIds) {
  requireAuth_();
  const sheet = getSheet('가입신청');
  const memberSheet = getSheet('회원목록');
  let count = 0;
  rowIds.forEach(function(rowId) {
    const row = sheet.getRange(rowId, 1, 1, 10).getValues()[0];
    if (String(row[9]) !== '대기중') return;
    memberSheet.appendRow([
      row[1], row[2], row[3], normalizePhone_(row[4]), row[5], row[6],
      Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'),
      '활성'
    ]);
    sheet.getRange(rowId, 10).setValue('승인');
    count++;
  });
  return { success: true, count: count };
}

function rejectApplication(rowId) {
  requireAuth_();
  getSheet('가입신청').getRange(rowId, 10).setValue('거절');
  return { success: true };
}

// 폼 제출 이벤트에서 응답 값 배열 추출
// - 시트 응답 트리거: e.values 있음 (타임스탬프 포함)
// - 폼(Form) 직접 트리거: e.values 없음 → e.response(FormResponse)에서 순서대로 뽑고 타임스탬프를 앞에 붙임
function formEventValues_(e) {
  if (e && e.values && e.values.length) return e.values;
  if (e && e.response && e.response.getItemResponses) {
    var ts = e.response.getTimestamp ? e.response.getTimestamp() : new Date();
    var arr = [Utilities.formatDate(ts, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')];
    e.response.getItemResponses().forEach(function(ir) {
      var r = ir.getResponse();
      arr.push(Array.isArray(r) ? r.join(', ') : String(r == null ? '' : r));
    });
    return arr;
  }
  if (e && e.namedValues) {
    // 최후 수단: namedValues(순서 보장 안 됨)라도 있으면 값만 펼침
    return Object.keys(e.namedValues).map(function(k) { return String(e.namedValues[k]); });
  }
  return [];
}

// 가입신청 중복 접수 여부 — 최근 5분 이내 같은 이름+정규화 전화번호가 이미 있으면 중복으로 판단
// (이름=1열, 연락처=5열 / vals 0-based: 이름 vals[1], 연락처 vals[4])
function isDuplicateApplication_(sheet, vals) {
  var name = String(vals[1] || '').replace(/\s/g, '');
  var phone = normalizePhone_(vals[4] || '');
  if (!name && !phone) return false;
  var data = sheet.getDataRange().getValues();
  var now = new Date().getTime();
  for (var i = data.length - 1; i >= 1; i--) {
    var rowTs = data[i][0] ? new Date(data[i][0]).getTime() : 0;
    if (rowTs && (now - rowTs) > 5 * 60 * 1000) break;  // 5분 넘게 지난 과거 행은 검사 중단
    var rName = String(data[i][1] || '').replace(/\s/g, '');
    var rPhone = normalizePhone_(data[i][4] || '');
    if (rName === name && rPhone === phone) return true;
  }
  return false;
}

// 가입신청 폼 트리거
function onMemberFormSubmit(e) {
  // 리더신청 폼에서 잘못 호출된 경우 차단
  if (e && e.source) {
    const title = e.source.getTitle ? e.source.getTitle() : '';
    if (title && title.indexOf('리더') >= 0) {
      Logger.log('onMemberFormSubmit 차단: 리더신청 폼에서 호출됨 (' + title + ')');
      return;
    }
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('가입신청');
  if (!sheet) {
    sheet = ss.insertSheet('가입신청');
    const headers = ['타임스탬프', '이름', '나이', '성별', '연락처', '거주지역', '관심분야', '가입동기', '동의여부', '처리상태'];
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setFontWeight('bold');
    range.setBackground('#5b5bd6');
    range.setFontColor('white');
  }
  var vals = formEventValues_(e);
  // 중복 접수 방어 — 트리거가 두 번 발동해도(폼+시트 이중 등록 등) 같은 신청이 두 번 기록되지 않도록
  // 최근 접수분 중 이름+정규화 전화번호가 같으면 건너뜀 (0102030201 == 102030201 로 매칭됨)
  if (isDuplicateApplication_(sheet, vals)) {
    Logger.log('onMemberFormSubmit 중복 접수 무시: ' + (vals[1] || '') + ' / ' + (vals[4] || ''));
    return;
  }
  sheet.appendRow([...vals, '대기중']);
  // 접수 즉시 담당자 자동 배정 + 운영진 텔레그램 알림
  var assignee = '';
  try {
    autoAssignCore_();
    assignee = String(sheet.getRange(sheet.getLastRow(), 11).getValue() || '');
  } catch (err) {}
  try {
    notifyTelegram_('🆕 새 가입신청\n• ' + (vals[1] || '?') + ' (' + normalizeAge_(vals[2] || '') + '/' + normalizeGender_(vals[3] || '') + ', ' + (vals[5] || '-') + ')'
      + (assignee ? '\n• 담당: ' + assignee : '')
      + '\n관리툴 → 가입신청에서 신원확인 후 승인해주세요');
  } catch (err2) {}
}

// ===== 리더신청 관리 =====
function getOrCreateLeaderSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let target = ss.getSheetByName('리더신청');
  if (!target) {
    target = ss.insertSheet('리더신청');
    const h = ['타임스탬프','이름','연락처','모임명','분야','1회차','2회차','3회차','장소','최대인원','모임소개','준비물','처리상태','오픈채팅링크','입장코드'];
    const r = target.getRange(1, 1, 1, h.length);
    r.setValues([h]); r.setFontWeight('bold'); r.setBackground('#5b5bd6'); r.setFontColor('white');
  } else {
    if (String(target.getRange(1, 14).getValue() || '').trim() !== '오픈채팅링크') {
      target.getRange(1, 14).setValue('오픈채팅링크').setFontWeight('bold').setBackground('#5b5bd6').setFontColor('white');
    }
    if (String(target.getRange(1, 15).getValue() || '').trim() !== '입장코드') {
      target.getRange(1, 15).setValue('입장코드').setFontWeight('bold').setBackground('#5b5bd6').setFontColor('white');
    }
  }
  return target;
}

// 폼 응답이 "설문지 응답 시트*"로 들어오는 경우 자동 감지 후 "리더신청"으로 동기화
function syncLeaderFormResponses_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const target = getOrCreateLeaderSheet_();

  // 가입신청 시트의 연결된 폼 URL (리더 폼과 구분하기 위해)
  const memberSheet = ss.getSheetByName('가입신청');
  const memberFormUrl = memberSheet ? memberSheet.getFormUrl() : null;

  // 이미 동기화된 타임스탬프 목록
  const existingRows = target.getDataRange().getValues();
  const existingTs = new Set(existingRows.slice(1).map(r => String(r[0])));

  // 리더 폼 응답 시트 자동 탐색 (리더신청·가입신청 제외, 폼 연결된 시트)
  ss.getSheets().forEach(function(sheet) {
    const name = sheet.getName();
    if (name === '리더신청' || name === '가입신청') return;
    const formUrl = sheet.getFormUrl();
    if (!formUrl) return;
    if (memberFormUrl && formUrl === memberFormUrl) return; // 가입신청 폼 시트 스킵

    // 리더 폼 응답 시트로 확인 → 미동기 행 복사
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return;
    rows.slice(1).forEach(function(row) {
      const ts = String(row[0]);
      if (!ts || existingTs.has(ts)) return;
      const newRow = row.slice(0, 12);
      while (newRow.length < 12) newRow.push('');
      target.appendRow(newRow.concat(['대기중']));
      existingTs.add(ts);
    });
  });
}

// 리더신청 컬럼: 타임스탬프(0) 이름(1) 연락처(2) 모임명(3) 분야(4) 1회차(5) 2회차(6) 3회차(7) 장소(8) 최대인원(9) 모임소개(10) 준비물(11) 처리상태(12)
function getLeaderApps() {
  requireAuth_();
  syncLeaderFormResponses_(); // 폼 응답 시트 자동 동기화
  const sheet = getSheet('리더신청');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map((row, i) => ({
    id: i + 2,
    timestamp: String(row[0] || ''),
    name: String(row[1] || ''),
    phone: normalizePhone_(String(row[2] || '')),
    eventName: String(row[3] || ''),
    category: String(row[4] || ''),
    date1: fmtGasDate_(row[5]),
    date2: fmtGasDate_(row[6]),
    date3: fmtGasDate_(row[7]),
    place: String(row[8] || ''),
    maxSize: String(row[9] || ''),
    description: String(row[10] || ''),
    supplies: String(row[11] || ''),
    status: String(row[12] || '대기중'),
    chatLink: String(row[13] || ''),
    chatCode: String(row[14] || '')
  }));
}

// 기수 표기 '(N기)' 제거 후 순수 모임명 반환
function stripGeneration_(name) {
  return String(name || '').replace(/\s*\(\d+기\)\s*$/, '').trim();
}

// 같은 리더 + 같은 모임명이 모임목록에 이미 있으면 다음 기수를 붙여 유니크한 이름 생성
// (상태 무관 — 완료된 모임명과도 겹치면 옛 신청자가 딸려오므로 전체 대상 검사)
function makeUniqueEventName_(rawName, leader) {
  const baseName = stripGeneration_(rawName);
  const events = getEvents_();
  const same = events.filter(function(e) {
    return stripGeneration_(e.name) === baseName && String(e.leader).trim() === leader;
  });
  if (same.length === 0) return baseName;
  // 기존 최대 기수 다음 번호 부여 (기수 없는 최초 모임은 1기로 간주)
  let maxGen = 1;
  same.forEach(function(e) {
    const m = String(e.name).match(/\((\d+)기\)\s*$/);
    const g = m ? Number(m[1]) : 1;
    if (g > maxGen) maxGen = g;
  });
  return baseName + ' (' + (maxGen + 1) + '기)';
}

function approveLeaderApp(rowId) {
  requireAuth_();
  const sheet = getSheet('리더신청');
  const row = sheet.getRange(rowId, 1, 1, 15).getValues()[0];
  const eventSheet = getSheet('모임목록');
  const dates = [row[5], row[6], row[7]].filter(d => d && String(d).trim() !== '');
  // 회차별로 쪼개지 않고 한 모임으로 묶어 생성 — 한 번 신청 = 전 회차 참석
  const dateStr = dates.map(d => fmtGasDate_(d)).join(' / ');
  ensureEventDescCol_();
  ensureEventChatCol_();
  // 같은 리더가 같은 모임명으로 재개설 시 기존 신청자가 딸려오지 않도록 기수(2기,3기…)를 붙여 구분
  const eventName = makeUniqueEventName_(String(row[3]).trim(), String(row[1]).trim());
  // 리더가 제출한 오픈채팅 링크(14열)·입장코드(15열)를 모임목록 8·9열로 복사
  eventSheet.appendRow([eventName, dateStr, row[8], row[9], row[1], '모집중', row[10], String(row[13] || '').trim(), String(row[14] || '').trim()]);
  setTextCell_(eventSheet.getRange(eventSheet.getLastRow(), 9), String(row[14] || '').trim());  // 입장코드 앞자리 0 보존
  sheet.getRange(rowId, 13).setValue('승인');
  return { success: true };
}

function rejectLeaderApp(rowId) {
  requireAuth_();
  getSheet('리더신청').getRange(rowId, 13).setValue('거절');
  return { success: true };
}

// 리더신청 폼 트리거
function onLeaderFormSubmit(e) {
  // 가입신청 폼에서 잘못 호출된 경우 차단
  if (e && e.source) {
    const title = e.source.getTitle ? e.source.getTitle() : '';
    if (title && title.indexOf('리더') < 0) {
      Logger.log('onLeaderFormSubmit 차단: 리더신청 폼이 아닌 폼에서 호출됨 (' + title + ')');
      return;
    }
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('리더신청');
  if (!sheet) {
    sheet = ss.insertSheet('리더신청');
    const headers = ['타임스탬프', '이름', '연락처', '모임명', '분야', '1회차', '2회차', '3회차', '장소', '최대인원', '모임소개', '준비물', '처리상태'];
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setFontWeight('bold');
    range.setBackground('#5b5bd6');
    range.setFontColor('white');
  }
  var vals = formEventValues_(e);
  sheet.appendRow([...vals, '대기중']);
  try {
    notifyTelegram_('💡 새 리더 신청 (구글폼)\n• 모임: ' + (vals[3] || '?') + '\n• 리더: ' + (vals[1] || '?') + '\n관리툴 → 리더신청에서 승인해주세요');
  } catch (err) {}
}

// 트리거 올바르게 재설정 (Script Editor에서 한 번만 실행)
function setupTriggers() {
  requireAuth_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 기존 폼제출 트리거 전부 삭제
  // getProjectTriggers()로 조회 — forForm()으로 만든 트리거는 폼에 연결돼 있어
  // getUserTriggers(ss)로는 잡히지 않기 때문(중복 누적의 원인)
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT) {
      ScriptApp.deleteTrigger(t);
      Logger.log('기존 트리거 삭제: ' + t.getHandlerFunction());
    }
  });

  // 스프레드시트에 연결된 폼을 찾아 개별 트리거 등록
  ss.getSheets().forEach(function(sheet) {
    const formUrl = sheet.getFormUrl();
    if (!formUrl) return;
    try {
      const form = FormApp.openByUrl(formUrl);
      const title = form.getTitle();
      if (title.indexOf('리더') >= 0) {
        ScriptApp.newTrigger('onLeaderFormSubmit').forForm(form).onFormSubmit().create();
        Logger.log('✅ 리더신청 트리거 등록: ' + title);
      } else {
        ScriptApp.newTrigger('onMemberFormSubmit').forForm(form).onFormSubmit().create();
        Logger.log('✅ 가입신청 트리거 등록: ' + title);
      }
    } catch(err) {
      Logger.log('폼 접근 오류: ' + err);
    }
  });

  Logger.log('setupTriggers 완료');
}

// ===== 경고/주의 관리 =====
function getOrCreateWarningSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('경고이력');
  if (!sheet) {
    sheet = ss.insertSheet('경고이력');
    const headers = ['날짜', '회원이름', '유형', '사유', '1:1발송완료', '비고'];
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setFontWeight('bold');
    range.setBackground('#5b5bd6');
    range.setFontColor('white');
  }
  return sheet;
}

function getWarnings() {
  requireAuth_();
  const sheet = getOrCreateWarningSheet_();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const now = new Date();
  const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
  return data.slice(1).map(function(row, i) {
    var rawDate = row[0];
    var date = rawDate instanceof Date ? rawDate : (rawDate ? new Date(rawDate) : null);
    var expired = date ? (now - date) > THREE_MONTHS_MS : false;
    return {
      id: i + 2,
      date: date ? Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd') : '',
      memberName: String(row[1] || ''),
      type: String(row[2] || ''),
      reason: String(row[3] || ''),
      messageSent: row[4] === true || String(row[4]).toUpperCase() === 'TRUE',
      note: String(row[5] || ''),
      expired: expired
    };
  });
}

function addWarning(data) {
  requireAuth_();
  const sheet = getOrCreateWarningSheet_();
  sheet.appendRow([new Date(), data.memberName, data.type, data.reason, false, data.note || '']);
  return { success: true };
}

function markWarningMessageSent(rowId) {
  requireAuth_();
  getOrCreateWarningSheet_().getRange(rowId, 5).setValue(true);
  return { success: true };
}

// ===== 공지 템플릿 (운영자 편집·저장) =====
// 저장된 커스텀 문구만 반환 — 없으면 프론트가 기본값 사용
function getNoticeTemplates() {
  requireAuth_();
  const raw = PropertiesService.getScriptProperties().getProperty('noticeTemplates');
  return raw ? JSON.parse(raw) : {};
}

function saveNoticeTemplate(key, text) {
  requireAuth_();
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('noticeTemplates');
  const obj = raw ? JSON.parse(raw) : {};
  obj[key] = String(text || '');
  props.setProperty('noticeTemplates', JSON.stringify(obj));
  return { success: true };
}

// 특정 템플릿을 기본값으로 되돌림 (저장된 커스텀 삭제)
function resetNoticeTemplate(key) {
  requireAuth_();
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('noticeTemplates');
  if (raw) {
    const obj = JSON.parse(raw);
    delete obj[key];
    props.setProperty('noticeTemplates', JSON.stringify(obj));
  }
  return { success: true };
}
