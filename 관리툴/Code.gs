// 2030 안산 소모임 관리툴

var ALLOWED_EMAILS = [
  'capshinsmg@gmail.com'
];

// 신원확인 담당 운영자 목록 — 섭외 후 { email, name } 형식으로 추가
var OPERATORS = [
  { email: 'capshinsmg@gmail.com', name: '민규' }
];

var INQUIRY_KAKAO_URL = 'https://open.kakao.com/o/ssuPwLBi';

function checkAuth() {
  var email = Session.getActiveUser().getEmail();
  return {
    email: email,
    allowed: email !== '' && ALLOWED_EMAILS.indexOf(email) !== -1
  };
}

// 서버측 인증 가드 — 화이트리스트 외 호출 차단
function requireAuth_() {
  var email = Session.getActiveUser().getEmail();
  if (!email || ALLOWED_EMAILS.indexOf(email) === -1) {
    throw new Error('접근 권한이 없습니다.');
  }
}

function getOperators() {
  requireAuth_();
  return OPERATORS;
}

function fmtGasDate_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  return String(v);
}

function fmtKorDate_(s) {
  if (!s) return '';
  var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!m) return String(s);
  var days = ['일','월','화','수','목','금','토'];
  var dt = new Date(+m[1], +m[2]-1, +m[3], +(m[4]||0), +(m[5]||0));
  var result = (+m[2]) + '월 ' + (+m[3]) + '일(' + days[dt.getDay()] + ')';
  if (m[4]) result += ' ' + ('0'+m[4]).slice(-2) + ':' + m[5];
  return result;
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

function buildApplyPage(eventName) {
  const events = getEvents_();
  const ev = events.find(e => e.name === eventName);
  if (!ev || ev.status === '완료') {
    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;text-align:center;padding:60px 20px;background:#f0f0f5}</style></head><body><div style="font-size:48px;margin-bottom:16px">😢</div><div style="font-size:18px;font-weight:600;color:#333">찾을 수 없거나 마감된 모임입니다.</div></body></html>`;
  }
  const safe = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const js = s => String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
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
</style>
</head>
<body>
<div class="card">
  <div id="fv">
    <div class="badge">📅 모임 신청</div>
    <h1>${safe(ev.name)}</h1>
    <div class="info">
      <div class="info-row"><span>📅</span><span>${fmtKorDate_(ev.date)}</span></div>
      <div class="info-row"><span>📍</span><span>${safe(ev.location)}</span></div>
      <div class="info-row"><span>👤</span><span>리더: ${safe(ev.leader)}</span></div>
    </div>
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
    <div class="done-sub">운영진 확인 후<br>개별 연락드릴게요 😊</div>
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
  const isDup = existing.slice(1).some(row => String(row[1]) === data.eventName && normalizePhone_(row[3]) === normalizePhone_(data.phone));
  if (isDup) return { success: false, message: 'already' };
  sheet.appendRow([Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm'), data.eventName, data.name, data.phone, '대기중']);
  return { success: true };
}

function getEventApplicants(eventName) {
  requireAuth_();
  const sheet = getSheet('모임신청대기');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1)
    .map((row, i) => ({ id: i + 2, eventName: String(row[1]||''), name: String(row[2]||''), phone: String(row[3]||''), status: String(row[4]||'대기중') }))
    .filter(r => r.eventName === eventName);
}

function getAllApplicants() {
  requireAuth_();
  const sheet = getSheet('모임신청대기');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map((row, i) => ({ id: i + 2, eventName: String(row[1]||''), name: String(row[2]||''), phone: String(row[3]||''), status: String(row[4]||'대기중') }));
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
    const cnt = getRegistrations_().filter(function(r) { return r.eventName === ev.name; }).length;
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
  getOrCreateLeaderSheet_().appendRow([
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    v.member.name, v.member.phone,
    data.eventName, data.category,
    data.date1 || '', data.date2 || '', data.date3 || '',
    data.location, data.maxMembers || '', data.intro, data.materials || '',
    '대기중'
  ]);
  return { success: true };
}

function buildBoardPage() {
  const safe = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const js = s => String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
  const regs = getRegistrations_();
  const events = getEvents_().filter(e => e.status === '모집중');

  const cardsHtml = events.length ? events.map(e => {
    const cnt = regs.filter(r => r.eventName === e.name).length;
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

function getMembers_() {
  const sheet = getSheet('회원목록');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map((row, i) => ({
    id: i + 2,
    name: String(row[0] || ''),
    age: String(row[1] || ''),
    gender: String(row[2] || ''),
    phone: normalizePhone_(String(row[3] || '')),
    location: String(row[4] || ''),
    hobby: String(row[5] || ''),
    joinDate: row[6] ? (row[6] instanceof Date ? Utilities.formatDate(row[6], 'Asia/Seoul', 'yyyy-MM-dd') : String(row[6])) : '',
    status: String(row[7] || '활성'),
    flagged: row[8] === true || String(row[8]).toUpperCase() === 'TRUE'
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
    data.name, data.age, data.gender, data.phone,
    data.location, data.hobby, data.joinDate, data.status
  ]]);
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
    data.name, data.age, data.gender, data.phone,
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
    status: String(row[5] || '모집중')
  }));
}

function addEvent(data) {
  requireAuth_();
  getSheet('모임목록').appendRow([
    data.name, data.date, data.location, data.maxMembers, data.leader, '모집중'
  ]);
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
    age: String(row[2] || ''),
    gender: String(row[3] || ''),
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
  const sheet = getSheet('가입신청');
  if (!sheet) return { success: false, count: 0 };
  ensureAppExtraCols_(sheet);
  const data = sheet.getDataRange().getValues();
  const names = OPERATORS.map(function(o) { return o.name; });
  if (!names.length) return { success: false, count: 0 };
  // 기존 배정 건수를 세서 적게 가진 운영자부터 이어서 분배
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
    const next = names.slice().sort(function(a, b) { return counts[a] - counts[b]; })[0];
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
  sheet.appendRow([...e.values, '대기중']);
}

// ===== 리더신청 관리 =====
function getOrCreateLeaderSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let target = ss.getSheetByName('리더신청');
  if (!target) {
    target = ss.insertSheet('리더신청');
    const h = ['타임스탬프','이름','연락처','모임명','분야','1회차','2회차','3회차','장소','최대인원','모임소개','준비물','처리상태'];
    const r = target.getRange(1, 1, 1, h.length);
    r.setValues([h]); r.setFontWeight('bold'); r.setBackground('#5b5bd6'); r.setFontColor('white');
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
    phone: String(row[2] || ''),
    eventName: String(row[3] || ''),
    category: String(row[4] || ''),
    date1: fmtGasDate_(row[5]),
    date2: fmtGasDate_(row[6]),
    date3: fmtGasDate_(row[7]),
    place: String(row[8] || ''),
    maxSize: String(row[9] || ''),
    description: String(row[10] || ''),
    supplies: String(row[11] || ''),
    status: String(row[12] || '대기중')
  }));
}

function approveLeaderApp(rowId) {
  requireAuth_();
  const sheet = getSheet('리더신청');
  const row = sheet.getRange(rowId, 1, 1, 13).getValues()[0];
  const eventSheet = getSheet('모임목록');
  const dates = [row[5], row[6], row[7]].filter(d => d && String(d).trim() !== '');
  if (dates.length <= 1) {
    eventSheet.appendRow([row[3], dates[0] || '', row[8], row[9], row[1], '모집중']);
  } else {
    dates.forEach((date, i) => {
      eventSheet.appendRow([`${row[3]} (${i+1}회차)`, date, row[8], row[9], row[1], '모집중']);
    });
  }
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
  sheet.appendRow([...e.values, '대기중']);
}

// 트리거 올바르게 재설정 (Script Editor에서 한 번만 실행)
function setupTriggers() {
  requireAuth_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 기존 on_form_submit 트리거 전부 삭제
  ScriptApp.getUserTriggers(ss).forEach(function(t) {
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
