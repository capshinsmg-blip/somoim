function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('2030 안산 소모임 관리툴')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

// ===== 시트 초기화 =====
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = {
    '회원목록':   ['이름', '나이', '전화번호', '거주지', '취미', '가입일', '상태'],
    '모임목록':   ['모임명', '날짜', '장소', '최대인원', '리더', '상태'],
    '신청현황':   ['회원명', '모임명', '신청일', '출석여부'],
    '제재기록':   ['회원명', '사유', '날짜', '처리결과']
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
function getMembers() {
  const sheet = getSheet('회원목록');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map((row, i) => ({
    id: i + 2,
    name: String(row[0] || ''),
    age: row[1],
    phone: String(row[2] || ''),
    location: String(row[3] || ''),
    hobby: String(row[4] || ''),
    joinDate: String(row[5] || ''),
    status: String(row[6] || '활성')
  }));
}

function addMember(data) {
  getSheet('회원목록').appendRow([
    data.name, data.age, data.phone, data.location, data.hobby,
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'),
    '활성'
  ]);
  return { success: true };
}

function updateMemberStatus(rowId, status) {
  getSheet('회원목록').getRange(rowId, 7).setValue(status);
  return { success: true };
}

// ===== 모임 관리 =====
function getEvents() {
  const sheet = getSheet('모임목록');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map((row, i) => ({
    id: i + 2,
    name: String(row[0] || ''),
    date: String(row[1] || ''),
    location: String(row[2] || ''),
    maxMembers: row[3],
    leader: String(row[4] || ''),
    status: String(row[5] || '모집중')
  }));
}

function addEvent(data) {
  getSheet('모임목록').appendRow([
    data.name, data.date, data.location, data.maxMembers, data.leader, '모집중'
  ]);
  return { success: true };
}

function updateEventStatus(rowId, status) {
  getSheet('모임목록').getRange(rowId, 6).setValue(status);
  return { success: true };
}

// ===== 신청 현황 =====
function getRegistrations() {
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
  const events = getEvents();
  const registrations = getRegistrations();
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
  getSheet('신청현황').getRange(rowId, 4).setValue(status);
  return { success: true };
}

// ===== 제재 기록 =====
function getSanctions() {
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
  getSheet('제재기록').appendRow([
    data.memberName, data.reason,
    Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'),
    data.result
  ]);
  const members = getMembers();
  const member = members.find(m => m.name === data.memberName);
  if (member) updateMemberStatus(member.id, '제재');
  return { success: true };
}
