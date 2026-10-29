/**
 * ============================================================================
 * AIONE LAB 2026학년도 신규 연구원 입실 지원서 자동화 시스템
 * 대전대학교 컴퓨터공학 인공지능 연구실 (AIONE LAB)
 * 
 * [주요 기능]
 * 1. 지원서 제출 시 정식 A4 규격 HTML -> PDF 자동 변환 & 구글 드라이브 지정 폴더 저장
 * 2. 랩장 이메일(och7905@naver.com)로 원클릭 열람 링크가 포함된 접수 알림 메일 즉시 발송
 * 3. 구글 스프레드시트 최하단 행에 지원자 데이터 및 PDF 열람 링크 자동 기록
 * 4. 웹사이트 관리자 포털 실시간 연동 (조회, 비밀번호 변경, 지원서 삭제 API)
 * ============================================================================
 */

// 1. 연구실 구글 드라이브 폴더 ID (AIONE LAB 지원서 보관용)
const DRIVE_FOLDER_ID = '1MpmUBVRdnnOnz9AQByEbG1Kc25fMWy8R';

// 2. 알림 수신 이메일 주소 목록 (단일 문자열, 쉼표 구분 문자열, 또는 배열[] 모두 지원)
// 예시 1: ['och7905@naver.com', 'creemur@dju.kr'] (배열 형태 - 추천)
// 예시 2: 'och7905@naver.com, creemur@dju.kr' (쉼표 구분 문자열 형태)
const NOTIFICATION_EMAILS = [
  'och7905@naver.com' // 오창현 랩장 (필요 시 여기에 쉼표 후 '추가이메일@...' 추가)
];
const NOTIFICATION_EMAIL = NOTIFICATION_EMAILS; // 하위 호환성 유지 변수

// 3. 관리자 기본 비밀번호 SHA-256 단방향 암호화 해시 목록 (복호화 불가 단방향 보안 해시)
const DEFAULT_ADMIN_PASSWORD_HASHES = [
  'ff6c048a8334f93d06ffafdd7ba4b433cb735ccf63453ed39c52900d419397f6'
];

// 3-1. 랩원용 비밀번호 SHA-256 단방향 암호화 해시 목록 (복호화 불가 단방향 보안 해시)
const DEFAULT_MEMBER_PASSWORD_HASHES = [
  '29a5db2f91e94992bc857c198836c04ffc0b375a0df0835d3c73d6a3419e8c50',
  '3940070561060ddc20164314c9dfa5b43b7c8abce3118e839a6583e7ae13a13c'
];

// 4. 스프레드시트 시트 이름
const SHEET_NAME = '지원자명단';

/**
 * [구글 드라이브 폴더 취득 헬퍼]
 * 1) 설정된 DRIVE_FOLDER_ID로 우선 접근
 * 2) 만약 ID 오류나 접근권한 문제가 발생할 경우, 현재 스프레드시트가 위치한 상위 폴더를 자동 감지하여 동일 폴더에 100% 저장
 * 3) 최후의 수단으로 루트 폴더 사용
 */
function getApplicationDriveFolder() {
  if (DRIVE_FOLDER_ID && DRIVE_FOLDER_ID.length > 10) {
    try {
      var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      if (folder) return folder;
    } catch (e) {
      Logger.log('Drive folder getById warning: ' + e);
    }
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      var ssFile = DriveApp.getFileById(ss.getId());
      var parents = ssFile.getParents();
      if (parents.hasNext()) {
        var parentFolder = parents.next();
        Logger.log('Auto-detected spreadsheet parent folder: ' + parentFolder.getName());
        return parentFolder;
      }
    }
  } catch (e) {
    Logger.log('Spreadsheet parent folder detection warning: ' + e);
  }

  return DriveApp.getRootFolder();
}


/**
 * ----------------------------------------------------------------------------
 * 1. POST 요청 핸들러: 웹페이지 지원서 제출 처리
 * ----------------------------------------------------------------------------
 */
function doPost(e) {
  try {
    let data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    const name = (data.name || '지원자').trim();
    const studentId = (data.student_id || '학번미입력').trim();
    const grade = (data.grade || '-').trim();
    const phone = (data.phone || '-').trim();
    const military = (data.military || '-').trim();
    const keywordIntro = (data.keyword_intro || '-').trim();
    const motivation = (data.motivation || '-').trim();
    const problemSolving = (data.problem_solving || '-').trim();
    const studyPlan = (data.study_plan || '-').trim();
    const expectation = (data.expectation || '-').trim();
    const careerPlan = (data.career_plan || '-').trim();
    const techStack = (data.tech_stack || '없음').trim();
    const desiredActivities = (data.desired_activities || '없음').trim();
    const interviewTimes = (data.interview_available_times || '-').trim();
    const portfolioLinks = (data.portfolio_links || '없음').trim();
    const submitDate = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy. MM. dd HH:mm');

    // Step A. 구글 드라이브 지정 폴더 접근
    const driveFolder = getApplicationDriveFolder();

    const pdfFileName = 'AIONE_지원서_' + studentId + '_' + name + '.pdf';
    let pdfFile = null;

    // Step B-1. 프론트엔드에서 2-Page 공식 PDF 바이너리(Base64)가 전달된 경우 (100% 무손실 복원)
    if (data.pdf_base64 && String(data.pdf_base64).length > 50) {
      try {
        let rawB64 = String(data.pdf_base64).trim();
        if (rawB64.indexOf(',') !== -1) {
          rawB64 = rawB64.split(',')[1];
        }
        rawB64 = rawB64.replace(/\s/g, '');
        const decodedBytes = Utilities.base64Decode(rawB64);
        const restoredBlob = Utilities.newBlob(decodedBytes, 'application/pdf', pdfFileName);
        pdfFile = driveFolder.createFile(restoredBlob);
        Logger.log('Successfully created PDF from base64: ' + pdfFileName);
      } catch (decodeErr) {
        Logger.log('Base64 decode warning: ' + decodeErr);
      }
    }

    // Step B-2. Base64가 없거나 실패한 경우 GAS 자체 HTML -> PDF 엔진 실행 (Fallback)
    if (!pdfFile) {
      try {
        const htmlTemplate = buildApplicationHtml({
          name,
          studentId,
          grade,
          phone,
          military,
          keywordIntro,
          motivation,
          problemSolving,
          studyPlan,
          expectation,
          careerPlan,
          techStack,
          desiredActivities,
          interviewTimes,
          portfolioLinks,
          submitDate
        });

        let fallbackBlob = null;
        try {
          fallbackBlob = Utilities.newBlob(htmlTemplate, 'text/html', 'app.html')
            .getAs('application/pdf')
            .setName(pdfFileName);
        } catch (blobErr) {
          Logger.log('Utilities.newBlob fallback error: ' + blobErr);
          fallbackBlob = HtmlService.createHtmlOutput(htmlTemplate)
            .getAs('application/pdf')
            .setName(pdfFileName);
        }

        if (fallbackBlob) {
          pdfFile = driveFolder.createFile(fallbackBlob);
          Logger.log('Successfully created PDF from HTML fallback: ' + pdfFileName);
        }
      } catch (htmlErr) {
        Logger.log('HTML to PDF fallback warning: ' + htmlErr);
      }
    }

    // Step C. 열람 권한 부여 및 열람 URL 획득
    let pdfUrl = '';
    if (pdfFile) {
      try {
        pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (_) {}
      pdfUrl = pdfFile.getUrl();
    }

    // Step D. 랩장 이메일로 즉시 알림 발송
    sendLeaderNotification({
      name,
      studentId,
      grade,
      phone,
      military,
      keywordIntro,
      techStack,
      interviewTimes,
      portfolioLinks,
      pdfUrl,
      submitDate
    });

    // Step E. 스프레드시트에 행 추가
    appendApplicantToSheet({
      submitDate,
      name,
      studentId,
      grade,
      phone,
      military,
      keywordIntro,
      motivation,
      problemSolving,
      studyPlan,
      expectation,
      careerPlan,
      techStack,
      desiredActivities,
      interviewTimes,
      portfolioLinks,
      pdfUrl
    });

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: '지원서가 드라이브에 안전하게 저장되었으며 랩장님께 알림이 발송되었습니다.',
      pdf_url: pdfUrl,
      name: name,
      student_id: studentId
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * ----------------------------------------------------------------------------
 * 2. GET 요청 핸들러: 웹사이트 관리자 포털 연동
 * ----------------------------------------------------------------------------
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'ping';

  // 1. 단순 핑 테스트
  if (action === 'ping') {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      service: 'AIONE LAB Application & PDF System',
      version: '2026.1'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 2. 지원자 전체 목록 조회 (총괄 관리자 및 랩원 모두 조회 가능)
  if (action === 'get_applicants') {
    const enteredPw = (e.parameter.pw || '').trim();
    const role = getAuthRole(enteredPw);
    if (!role) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '인증 실패: 비밀번호가 올바르지 않습니다.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const applicants = fetchApplicantsFromSheet();
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      role: role, // 'admin' 또는 'member'
      applicants: applicants
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 3. 관리자(총괄) 비밀번호 변경
  if (action === 'change_password') {
    const oldPw = (e.parameter.old_pw || '').trim();
    const newPw = (e.parameter.new_pw || '').trim();

    if (!verifyAdminPassword(oldPw)) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '현재 관리자 비밀번호가 일치하지 않습니다.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!newPw) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '새 관리자 비밀번호를 입력해주세요.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const newHash = computeSha256(newPw);
    PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH', newHash);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: '관리자 비밀번호가 성공적으로 변경되었습니다.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 3-1. 랩원용 비밀번호 변경 (총괄 관리자만 변경 가능)
  if (action === 'change_member_password') {
    const adminPw = (e.parameter.admin_pw || '').trim();
    const newPw = (e.parameter.new_pw || '').trim();

    if (!verifyAdminPassword(adminPw)) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '관리자 인증 실패: 랩원 비밀번호 변경은 총괄 관리자만 가능합니다.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!newPw) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '새로운 랩원용 비밀번호를 입력해주세요.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const newHash = computeSha256(newPw);
    PropertiesService.getScriptProperties().setProperty('MEMBER_PASSWORD_HASH', newHash);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: '랩원용 비밀번호가 성공적으로 변경되었습니다.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 4. 지원서 단일 또는 선택 일괄 삭제 (오직 총괄 관리자만 가능, 랩원 절대 불가)
  if (action === 'delete_applicant') {
    const enteredPw = (e.parameter.pw || '').trim();
    if (!verifyAdminPassword(enteredPw)) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '삭제 권한이 없습니다: 지원서 삭제는 총괄 관리자(Admin)만 수행할 수 있습니다.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const targetStudentId = (e.parameter.student_id || '').trim();
    const targetName = (e.parameter.name || '').trim();

    var deleted = false;
    if (targetStudentId.indexOf(',') !== -1) {
      var ids = targetStudentId.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      ids.forEach(function(id) {
        if (deleteApplicantFromSheet(id, '')) deleted = true;
      });
    } else {
      deleted = deleteApplicantFromSheet(targetStudentId, targetName);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: deleted ? 'success' : 'not_found',
      message: deleted ? '성공적으로 삭제되었습니다.' : '해당 지원자를 찾을 수 없습니다.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'error',
    message: '알 수 없는 요청입니다.'
  })).setMimeType(ContentService.MimeType.JSON);
}


/**
 * ----------------------------------------------------------------------------
 * 3. 랩장 접수 알림 이메일 발송
 * ----------------------------------------------------------------------------
 */
function sendLeaderNotification(info) {
  const subject = '[AIONE LAB] 신규 지원서 접수 알림 (' + info.name + ' / ' + info.studentId + ' / ' + info.grade + ')';

  const htmlBody = `
    <div style="font-family: 'Apple SD Gothic Neo', Pretendard, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
      
      <!-- Header -->
      <div style="border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 20px;">
        <span style="font-size: 11px; font-weight: 700; color: #0284c7; letter-spacing: 0.5px;">DAEJEON UNIVERSITY · AIONE LAB</span>
        <h2 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 800; color: #0f172a;">2026 연구원 신규 지원서 접수 알림</h2>
      </div>

      <!-- Introduction -->
      <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 18px;">
        안녕하세요 랩장님, <strong>AIONE LAB 2026학년도 신규 연구원 모집</strong>에 새로운 지원서가 접수되었습니다.<br>
        구글 드라이브에 PDF 원본이 자동 저장되었으며, 주요 인적사항은 아래와 같습니다.
      </p>

      <!-- Summary Card -->
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 22px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12.5px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 28%; font-weight: 600;">성명 / 학번</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${escapeHtml(info.name)} (${escapeHtml(info.studentId)})</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">지원구분 / 학년</td>
            <td style="padding: 6px 0; color: #0284c7; font-weight: 700;">${escapeHtml(info.grade)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">연락처 (전화번호)</td>
            <td style="padding: 6px 0; color: #0f172a;"><a href="tel:${escapeHtml(info.phone)}" style="color: #0284c7; text-decoration: none; font-weight: 600;">${escapeHtml(info.phone)}</a></td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">병역 구분</td>
            <td style="padding: 6px 0; color: #334155;">${escapeHtml(info.military)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">표현 단어</td>
            <td style="padding: 6px 0; color: #334155;">${escapeHtml(info.keywordIntro)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">면접 가능 시간대</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${escapeHtml(info.interviewTimes)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">기술 스택 / 경험</td>
            <td style="padding: 6px 0; color: #334155;">${escapeHtml(info.techStack)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">포트폴리오 링크</td>
            <td style="padding: 6px 0; color: #334155; word-break: break-all;">${escapeHtml(info.portfolioLinks)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">접수 일시</td>
            <td style="padding: 6px 0; color: #64748b; font-size: 11.5px;">${escapeHtml(info.submitDate)}</td>
          </tr>
        </table>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin: 26px 0 20px 0;">
        <a href="${info.pdfUrl}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 13px 28px; font-size: 13.5px; font-weight: 700; border-radius: 8px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);">
          📄 구글 드라이브 공식 지원서 PDF 열람하기
        </a>
      </div>

      <!-- Footer Note -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 11px; color: #94a3b8; text-align: center;">
        대전대학교 서문 방면 융합과학관 217호 &amp; 330호 (AIONE LAB 인공지능 연구실)<br>
        본 메일은 AIONE LAB 공식 웹사이트 지원 시스템을 통해 자동 발송되었습니다.
      </div>
    </div>
  `;

  // 이메일 수신자 파싱 (배열 또는 쉼표 구분 문자열 지원)
  var targetEmails = (typeof NOTIFICATION_EMAILS !== 'undefined' ? NOTIFICATION_EMAILS : NOTIFICATION_EMAIL);
  var recipientString = Array.isArray(targetEmails) ? targetEmails.join(',') : String(targetEmails || 'och7905@naver.com');

  MailApp.sendEmail({
    to: recipientString,
    subject: subject,
    htmlBody: htmlBody
  });
}


/**
 * ----------------------------------------------------------------------------
 * 4. A4 규격 정식 지원서 HTML 빌더 (PDF 렌더링용)
 * ----------------------------------------------------------------------------
 */
function buildApplicationHtml(data) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <style>
      @page {
        size: A4 portrait;
        margin: 12mm 14mm;
      }
      body {
        font-family: 'Apple SD Gothic Neo', Pretendard, 'Malgun Gothic', sans-serif;
        color: #0f172a;
        margin: 0;
        padding: 0;
        font-size: 11px;
        line-height: 1.45;
        background: #ffffff;
      }
      .page-header {
        border-bottom: 2px solid #0284c7;
        padding-bottom: 8px;
        margin-bottom: 12px;
      }
      .page-title {
        font-size: 18px;
        font-weight: 800;
        color: #0f172a;
        margin: 0;
      }
      .lab-sub {
        font-size: 9.5px;
        color: #0284c7;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .badge {
        display: inline-block;
        padding: 3px 8px;
        background: #f0fdf4;
        border: 1px solid #86efac;
        color: #166534;
        font-size: 10px;
        font-weight: 700;
        border-radius: 4px;
      }
      .sec-title {
        font-size: 12px;
        font-weight: 700;
        color: #0284c7;
        margin: 10px 0 6px 0;
        border-left: 3px solid #0284c7;
        padding-left: 7px;
      }
      table.data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10.5px;
        margin-bottom: 10px;
      }
      table.data-table th, table.data-table td {
        border: 1px solid #cbd5e1;
        padding: 6px 9px;
      }
      table.data-table th {
        background: #f8fafc;
        color: #334155;
        font-weight: 600;
        text-align: center;
      }
      .content-box {
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        margin-bottom: 10px;
      }
      .content-header {
        background: #f8fafc;
        border-bottom: 1px solid #cbd5e1;
        padding: 5px 9px;
        font-size: 10.5px;
        font-weight: 700;
        color: #1e293b;
      }
      .content-body {
        padding: 8px 10px;
        font-size: 10.5px;
        color: #1e293b;
        white-space: pre-wrap;
        line-height: 1.5;
        min-height: 48px;
        word-break: break-word;
      }
      .sign-box {
        margin-top: 14px;
        padding: 14px;
        border: 1px solid #cbd5e1;
        background: #f8fafc;
        border-radius: 4px;
        text-align: center;
      }
      .footer-note {
        margin-top: 10px;
        border-top: 1px solid #e2e8f0;
        padding-top: 6px;
        font-size: 9px;
        color: #94a3b8;
        display: flex;
        justify-content: space-between;
      }
    </style>
  </head>
  <body>
    <!-- Header -->
    <table style="width: 100%; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px;">
      <tr>
        <td style="vertical-align: middle;">
          <div class="lab-sub">DAEJEON UNIVERSITY · DEPT OF COMPUTER ENGINEERING</div>
          <div class="page-title">AIONE LAB 2026학년도 신규 연구원 입실 지원서</div>
          <div style="font-size: 9.5px; color: #64748b;">학부연구생 및 석사과정 연구원 선발</div>
        </td>
        <td style="text-align: right; vertical-align: middle;">
          <div class="badge">공식 접수 지원서</div>
          <div style="font-size: 9px; color: #64748b; margin-top: 4px;">접수일시: ${escapeHtml(data.submitDate)}</div>
        </td>
      </tr>
    </table>

    <!-- 1. 기본 인적사항 -->
    <div class="sec-title">1. 기본 인적사항</div>
    <table class="data-table">
      <tr>
        <th style="width: 15%;">성명</th>
        <td style="width: 35%; font-weight: 700;">${escapeHtml(data.name)}</td>
        <th style="width: 15%;">학번</th>
        <td style="width: 35%; font-family: monospace; font-weight: 700;">${escapeHtml(data.studentId)}</td>
      </tr>
      <tr>
        <th>지원구분/학년</th>
        <td style="color: #0284c7; font-weight: 700;">${escapeHtml(data.grade)}</td>
        <th>전화번호</th>
        <td style="font-family: monospace;">${escapeHtml(data.phone)}</td>
      </tr>
      <tr>
        <th>병역 구분</th>
        <td>${escapeHtml(data.military)}</td>
        <th>연구실 위치</th>
        <td style="color: #64748b; font-size: 9.5px;">대전대 서문 방면 융합과학관 217호 / 330호</td>
      </tr>
    </table>

    <!-- 2. 기술 스택 및 면접 일정 -->
    <div class="sec-title">2. 기술 스택 및 면접 일정 안내</div>
    <table class="data-table">
      <tr>
        <th style="width: 25%;">사용 가능한 프로그래밍 언어/툴</th>
        <td style="width: 75%;">${escapeHtml(data.techStack)}</td>
      </tr>
      <tr>
        <th>연구실에서 희망하는 연구/프로젝트</th>
        <td>${escapeHtml(data.desiredActivities)}</td>
      </tr>
      <tr>
        <th>대면 면접 가능 시간대</th>
        <td style="font-weight: 700; color: #0284c7;">${escapeHtml(data.interviewTimes)}</td>
      </tr>
      <tr>
        <th>포트폴리오 / GitHub 링크</th>
        <td style="word-break: break-all;">${escapeHtml(data.portfolioLinks)}</td>
      </tr>
    </table>

    <!-- 3. 자기소개 및 연구 역량 계획서 -->
    <div class="sec-title">3. 자기소개 및 연구 역량 계획서</div>
    
    <div class="content-box">
      <div class="content-header">가. 본인을 가장 잘 표현하는 단어 1가지와 그 이유</div>
      <div class="content-body">${escapeHtml(data.keywordIntro)}</div>
    </div>

    <div class="content-box">
      <div class="content-header">나. 연구실 지원 동기 (최대 500자)</div>
      <div class="content-body">${escapeHtml(data.motivation)}</div>
    </div>

    <div class="content-box">
      <div class="content-header">다. 인생에서 힘든 문제를 주도적으로 해결한 경험 및 배운 점 (최대 500자)</div>
      <div class="content-body">${escapeHtml(data.problemSolving)}</div>
    </div>

    <div class="content-box">
      <div class="content-header">라. AIONE LAB 연구원으로서의 학업 계획 (최대 200자)</div>
      <div class="content-body" style="min-height: 38px;">${escapeHtml(data.studyPlan)}</div>
    </div>

    <div class="content-box">
      <div class="content-header">마. 연구실에서 얻고자 하는 것 (최대 200자)</div>
      <div class="content-body" style="min-height: 38px;">${escapeHtml(data.expectation)}</div>
    </div>

    <div class="content-box">
      <div class="content-header">바. 졸업 후 진로 계획 (최대 200자)</div>
      <div class="content-body" style="min-height: 38px;">${escapeHtml(data.careerPlan)}</div>
    </div>

    <!-- Official Declaration and Signature -->
    <div class="sign-box">
      <p style="font-size: 10.5px; color: #334155; margin: 0 0 10px 0; line-height: 1.5;">
        본 지원서에 기재된 모든 사항은 사실과 다름없음을 서약하며,<br>
        대전대학교 컴퓨터공학 인공지능 연구실(AIONE LAB) 연구원으로 지원합니다.
      </p>
      <div style="font-size: 11px; font-weight: 700; color: #0f172a; margin-bottom: 10px;">
        ${escapeHtml(data.submitDate.split(' ')[0])}
      </div>
      <div style="text-align: right; padding-right: 20px; font-size: 11px; font-weight: 700;">
        지원자: <strong style="border-bottom: 1.5px solid #0f172a; padding: 0 15px;">${escapeHtml(data.name)}</strong> (인 또는 서명)
      </div>
      <div style="margin-top: 10px; font-size: 11px; font-weight: 800; color: #0284c7;">
        대전대학교 컴퓨터공학 인공지능 연구실 (AIONE LAB) 귀하
      </div>
    </div>

    <table style="width: 100%; margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 9px; color: #94a3b8;">
      <tr>
        <td>대전대학교 서문 방면 융합과학관 217호 &amp; 330호 (전승현 지도교수 / 오창현 랩장)</td>
        <td style="text-align: right;">AIONE LAB 2026 OFFICIAL FORM</td>
      </tr>
    </table>
  </body>
  </html>
  `;
}


/**
 * ----------------------------------------------------------------------------
 * 5. 스프레드시트 데이터 입출력 보조 함수
 * ----------------------------------------------------------------------------
 */
function getTargetSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return null;

  // 1. '지원자명단' 이름의 시트 탐색
  let sheet = ss.getSheetByName(SHEET_NAME);

  // 2. 없으면 첫 번째 시트를 사용하고 이름을 '지원자명단'으로 자동 동기화
  if (!sheet) {
    const sheets = ss.getSheets();
    if (sheets && sheets.length > 0) {
      sheet = sheets[0];
      try {
        sheet.setName(SHEET_NAME);
      } catch (_) {}
    } else {
      sheet = ss.insertSheet(SHEET_NAME);
    }
  }

  const headers = [
    '접수일시',
    '성명',
    '학번',
    '지원구분',
    '연락처',
    '병역구분',
    '나를표현하는단어',
    '지원동기',
    '문제해결경험',
    '학업계획',
    '얻고자하는것',
    '진로계획',
    '기술스택',
    '연구실희망활동',
    '면접가능시간',
    '포트폴리오링크',
    '드라이브PDF열람',
    'PDF원본URL'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#0284c7')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else {
    // 기존 시트의 17, 18번째 헤더 최신화 보장
    try {
      sheet.getRange(1, 17).setValue('드라이브PDF열람');
      sheet.getRange(1, 18).setValue('PDF원본URL');
    } catch (_) {}
  }
  return sheet;
}

function appendApplicantToSheet(item) {
  try {
    const sheet = getTargetSheet();
    if (!sheet) return;

    const hyperlinkFormula = item.pdfUrl ? '=HYPERLINK("' + item.pdfUrl + '", "📄 PDF 열람")' : '저장 실패';

    sheet.appendRow([
      item.submitDate,
      item.name,
      item.studentId,
      item.grade,
      item.phone,
      item.military,
      item.keywordIntro,
      item.motivation,
      item.problemSolving,
      item.studyPlan,
      item.expectation,
      item.careerPlan,
      item.techStack,
      item.desiredActivities,
      item.interviewTimes,
      item.portfolioLinks,
      hyperlinkFormula,
      item.pdfUrl || ''
    ]);

    // 17번째 열(Q열)에 확실한 클릭 가능 수식 및 하이퍼링크 스타일 지정
    const newRowNum = sheet.getLastRow();
    if (item.pdfUrl) {
      try {
        const linkCell = sheet.getRange(newRowNum, 17);
        linkCell.setFormula('=HYPERLINK("' + item.pdfUrl + '", "📄 PDF 열람")');
        sheet.getRange(newRowNum, 18).setValue(item.pdfUrl);

        try {
          linkCell.setFontColor('#0284c7').setFontLine('underline').setFontWeight('bold');
        } catch (_) {}
      } catch (fErr) {
        Logger.log('Set formula error: ' + fErr);
      }
    }
  } catch (err) {
    Logger.log('Spreadsheet appendRow warning: ' + err);
  }
}

/**
 * [자동 복구 엔진]
 * 구버전 스크립트 실행으로 인해 Q열에 원본 JSON({"name":...})이 남아있거나,
 * 드라이브 PDF 링크가 누락된 행을 자동 감지하여
 * 구글 드라이브 지정 폴더에 공식 2-Page PDF를 즉시 생성/연결하고 클릭 가능한 '=HYPERLINK'로 자동 전환합니다.
 */
function repairBrokenRows() {
  try {
    const sheet = getTargetSheet();
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    var driveFolder = getApplicationDriveFolder();

    const numRows = lastRow - 1;
    const values = sheet.getRange(2, 1, numRows, 18).getValues();

    for (var i = 0; i < numRows; i++) {
      var rowNum = i + 2;
      var colQVal = String(values[i][16] || '').trim();
      var colRVal = String(values[i][17] || '').trim();
      var sNameFromCol = String(values[i][1] || '').trim();
      var sIdFromCol = String(values[i][2] || '').trim();

      // 이름과 학번이 모두 비어있는 행은 패스
      if (!sNameFromCol && !sIdFromCol) continue;

      var isBrokenJson = colQVal.startsWith('{') && colQVal.indexOf('"name"') !== -1;
      var isMissingPdf = (!colRVal || colRVal.indexOf('drive.google.com') === -1) && (colQVal.indexOf('drive.google.com') === -1);

      // 복구가 필요한 대상인 경우
      if (isBrokenJson || isMissingPdf) {
        try {
          var parsed = {};
          if (isBrokenJson) {
            try { parsed = JSON.parse(colQVal); } catch (_) {}
          }

          var sName = parsed.name || sNameFromCol || '지원자';
          var sId = parsed.student_id || sIdFromCol || '학번미입력';
          var pdfFileName = 'AIONE_지원서_' + sId + '_' + sName + '.pdf';

          var pdfUrl = '';

          // 1) 드라이브 폴더 내 이미 동일 파일명의 PDF가 존재하는지 우선 확인
          var files = driveFolder.getFilesByName(pdfFileName);
          if (files.hasNext()) {
            var f = files.next();
            try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
            pdfUrl = f.getUrl();
          } else if (parsed.pdf_base64 && String(parsed.pdf_base64).length > 50) {
            // 2) JSON 데이터에 Base64가 포함된 경우 100% 무손실 복원
            try {
              var rawB64 = String(parsed.pdf_base64).trim();
              if (rawB64.indexOf(',') !== -1) rawB64 = rawB64.split(',')[1];
              rawB64 = rawB64.replace(/\s/g, '');
              var decodedBytes = Utilities.base64Decode(rawB64);
              var b64Blob = Utilities.newBlob(decodedBytes, 'application/pdf', pdfFileName);
              var b64File = driveFolder.createFile(b64Blob);
              try { b64File.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
              pdfUrl = b64File.getUrl();
            } catch (b64Err) {
              Logger.log('Base64 restore warning: ' + b64Err);
            }
          }

          // 3) 없으면 지원서 공식 규격 HTML -> PDF 컴파일 후 드라이브에 안전 저장
          if (!pdfUrl) {
            var html = buildApplicationHtml({
              name: sName,
              studentId: sId,
              grade: parsed.grade || String(values[i][3] || '-'),
              phone: parsed.phone || String(values[i][4] || '-'),
              military: parsed.military || String(values[i][5] || '-'),
              keywordIntro: parsed.keyword_intro || String(values[i][6] || '-'),
              motivation: parsed.motivation || String(values[i][7] || '-'),
              problemSolving: parsed.problem_solving || String(values[i][8] || '-'),
              studyPlan: parsed.study_plan || String(values[i][9] || '-'),
              expectation: parsed.expectation || String(values[i][10] || '-'),
              careerPlan: parsed.career_plan || String(values[i][11] || '-'),
              techStack: parsed.tech_stack || String(values[i][12] || '없음'),
              desiredActivities: parsed.desired_activities || String(values[i][13] || '없음'),
              interviewTimes: parsed.interview_available_times || String(values[i][14] || '-'),
              portfolioLinks: parsed.portfolio_links || String(values[i][15] || '없음'),
              submitDate: String(values[i][0] || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy. MM. dd HH:mm'))
            });

            var blob = null;
            try {
              blob = Utilities.newBlob(html, 'text/html', 'app.html').getAs('application/pdf').setName(pdfFileName);
            } catch (_) {
              blob = HtmlService.createHtmlOutput(html).getAs('application/pdf').setName(pdfFileName);
            }

            if (blob) {
              var created = driveFolder.createFile(blob);
              try { created.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
              pdfUrl = created.getUrl();
            }
          }

          if (pdfUrl) {
            var cellQ = sheet.getRange(rowNum, 17);
            cellQ.setFormula('=HYPERLINK("' + pdfUrl + '", "📄 PDF 열람")');
            sheet.getRange(rowNum, 18).setValue(pdfUrl);

            try {
              cellQ.setFontColor('#0284c7').setFontLine('underline').setFontWeight('bold');
            } catch (_) {}

            Logger.log('Successfully repaired row ' + rowNum + ': ' + sName + ' (' + sId + ') -> ' + pdfUrl);
          }
        } catch (repairErr) {
          Logger.log('Repair row ' + rowNum + ' error: ' + repairErr);
        }
      }
    }
  } catch (outerErr) {
    Logger.log('repairBrokenRows fatal: ' + outerErr);
  }
}

/**
 * 구글 드라이브 폴더의 실제 PDF 파일 상태와 스프레드시트 링크 점검 및 자동 보정
 * (PDF 파일 누락 시 자동 생성하여 시트 링크가 항상 유효하도록 보장하며, 지원자 행을 임의로 삭제하지 않습니다.)
 */
function syncDriveAndSheet() {
  try {
    const sheet = getTargetSheet();
    if (!sheet) return;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return;

    var driveFolder = getApplicationDriveFolder();
    var activeFileIds = {};
    var activeFileNames = {};

    try {
      var files = driveFolder.getFiles();
      while (files.hasNext()) {
        var file = files.next();
        if (!file.isTrashed()) {
          activeFileIds[file.getId()] = true;
          activeFileNames[file.getName()] = true;
        }
      }
    } catch (driveErr) {
      Logger.log('Drive folder access warning: ' + driveErr);
      return;
    }

    var numRows = lastRow - 1;
    var values = sheet.getRange(2, 1, numRows, 18).getValues();
    var formulas = sheet.getRange(2, 1, numRows, 18).getFormulas();

    for (var i = 0; i < numRows; i++) {
      var row = values[i];
      var formulaRow = formulas[i];
      var name = String(row[1] || '').trim();
      var studentId = String(row[2] || '').trim();

      if (!name && !studentId) continue;

      var colQFormula = String(formulaRow[16] || '').trim();
      var colRVal = String(row[17] || '').trim();

      var pdfUrl = colRVal || '';
      var fileExists = false;

      if (pdfUrl) {
        var match = pdfUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1] && activeFileIds[match[1]]) {
          fileExists = true;
        }
      }

      var expectedName = 'AIONE_지원서_' + (studentId || '학번미입력') + '_' + (name || '지원자') + '.pdf';
      if (!fileExists && activeFileNames[expectedName]) {
        fileExists = true;
      }

      // 만약 드라이브에 PDF가 없거나 수식이 깨진 경우, 지원자 데이터를 바탕으로 안전하게 자동 생성 및 재연결
      if (!fileExists) {
        try {
          var html = buildApplicationHtml({
            name: name || '지원자',
            studentId: studentId || '학번미입력',
            grade: String(row[3] || '-'),
            phone: String(row[4] || '-'),
            military: String(row[5] || '-'),
            keywordIntro: String(row[6] || '-'),
            motivation: String(row[7] || '-'),
            problemSolving: String(row[8] || '-'),
            studyPlan: String(row[9] || '-'),
            expectation: String(row[10] || '-'),
            careerPlan: String(row[11] || '-'),
            techStack: String(row[12] || '없음'),
            desiredActivities: String(row[13] || '없음'),
            interviewTimes: String(row[14] || '-'),
            portfolioLinks: String(row[15] || '없음'),
            submitDate: String(row[0] || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy. MM. dd HH:mm'))
          });

          var blob = null;
          try {
            blob = Utilities.newBlob(html, 'text/html', 'app.html').getAs('application/pdf').setName(expectedName);
          } catch (_) {
            blob = HtmlService.createHtmlOutput(html).getAs('application/pdf').setName(expectedName);
          }

          if (blob) {
            var newFile = driveFolder.createFile(blob);
            try { newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
            var restoredUrl = newFile.getUrl();
            var targetRowNum = i + 2;
            sheet.getRange(targetRowNum, 17).setFormula('=HYPERLINK("' + restoredUrl + '", "📄 PDF 열람")');
            sheet.getRange(targetRowNum, 18).setValue(restoredUrl);
            try {
              sheet.getRange(targetRowNum, 17).setFontColor('#0284c7').setFontLine('underline').setFontWeight('bold');
            } catch (_) {}
            Logger.log('Auto-restored missing PDF for row ' + targetRowNum + ': ' + expectedName);
          }
        } catch (healErr) {
          Logger.log('Auto-healing warning for row ' + (i + 2) + ': ' + healErr);
        }
      }
    }
  } catch (err) {
    Logger.log('syncDriveAndSheet error: ' + err);
  }
}

function fetchApplicantsFromSheet() {
  try {
    const sheet = getTargetSheet();
    if (!sheet) return [];

    // 1. 구버전 JSON 잔류 행 자동 복구 (Q열이 {"name":...} 형태인 경우 드라이브 PDF 생성 및 수식 전환)
    repairBrokenRows();

    // 2. 드라이브의 실제 PDF 상태와 시트 행을 자동 동기화
    syncDriveAndSheet();

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, 18).getValues();
    const result = [];

    for (let i = data.length - 1; i >= 0; i--) {
      const row = data[i];
      if (!row[1] && !row[2]) continue;

      result.push({
        submitted_at: row[0] ? String(row[0]) : '',
        name: row[1] ? String(row[1]) : '',
        student_id: row[2] ? String(row[2]) : '',
        grade: row[3] ? String(row[3]) : '',
        phone: row[4] ? String(row[4]) : '',
        military: row[5] ? String(row[5]) : '',
        keyword_intro: row[6] ? String(row[6]) : '',
        motivation: row[7] ? String(row[7]) : '',
        problem_solving: row[8] ? String(row[8]) : '',
        study_plan: row[9] ? String(row[9]) : '',
        expectation: row[10] ? String(row[10]) : '',
        career_plan: row[11] ? String(row[11]) : '',
        tech_stack: row[12] ? String(row[12]) : '',
        desired_activities: row[13] ? String(row[13]) : '',
        interview_available_times: row[14] ? String(row[14]) : '',
        portfolio_links: row[15] ? String(row[15]) : '',
        pdf_url: row[17] ? String(row[17]) : (row[16] ? String(row[16]) : '')
      });
    }

    return result;
  } catch (err) {
    Logger.log('fetchApplicantsFromSheet warning: ' + err);
    return [];
  }
}

function deleteApplicantFromSheet(studentId, name) {
  try {
    const sheet = getTargetSheet();
    if (!sheet) return false;

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;

    const numRows = lastRow - 1;
    const data = sheet.getRange(2, 1, numRows, 18).getValues();
    const formulas = sheet.getRange(2, 1, numRows, 18).getFormulas();

    for (let i = 0; i < numRows; i++) {
      const rowName = String(data[i][1] || '').trim();
      const rowId = String(data[i][2] || '').trim();
      const combinedPdf = String(formulas[i][16] || '') + ' ' + String(data[i][17] || '') + ' ' + String(data[i][16] || '');

      if (rowId === studentId || (name && rowName === name)) {
        // 1. 스프레드시트에서 행 삭제
        sheet.deleteRow(i + 2);

        // 2. 구글 드라이브에서도 해당 PDF 파일 삭제(휴지통 이동)
        deletePdfFromDrive(rowId, rowName, combinedPdf);
        return true;
      }
    }
    return false;
  } catch (err) {
    Logger.log('deleteApplicantFromSheet error: ' + err);
    return false;
  }
}

function deletePdfFromDrive(studentId, name, pdfUrl) {
  try {
    // 1. pdfUrl에서 파일 ID 추출하여 휴지통 이동
    if (pdfUrl) {
      const match = pdfUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        try {
          const file = DriveApp.getFileById(match[1]);
          if (file) file.setTrashed(true);
        } catch (_) {}
      }
    }

    // 2. 구글 드라이브 폴더에서 학번/이름 매칭 파일 검색하여 휴지통 이동
    try {
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        const fname = file.getName();
        if (fname.toLowerCase().indexOf('.pdf') !== -1) {
          if ((studentId && studentId !== '학번미입력' && fname.indexOf(studentId) !== -1) || 
              (name && name !== '지원자' && fname.indexOf(name) !== -1)) {
            file.setTrashed(true);
          }
        }
      }
    } catch (_) {}
  } catch (err) {
    Logger.log('deletePdfFromDrive warning: ' + err);
  }
}

function verifyAdminPassword(entered) {
  if (!entered) return false;
  const enteredHash = computeSha256(entered);
  const storedHash = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH');
  if (storedHash) {
    return enteredHash === storedHash || entered === storedHash;
  }
  return DEFAULT_ADMIN_PASSWORD_HASHES.indexOf(enteredHash) !== -1;
}

function verifyMemberPassword(entered) {
  if (!entered) return false;
  const enteredHash = computeSha256(entered);
  const storedHash = PropertiesService.getScriptProperties().getProperty('MEMBER_PASSWORD_HASH');
  if (storedHash) {
    return enteredHash === storedHash || entered === storedHash;
  }
  return DEFAULT_MEMBER_PASSWORD_HASHES.indexOf(enteredHash) !== -1;
}

function getAuthRole(entered) {
  if (verifyAdminPassword(entered)) return 'admin';
  if (verifyMemberPassword(entered)) return 'member';
  return null;
}

function computeSha256(str) {
  if (!str) return '';
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return rawHash.map(function(byte) {
    var v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * ----------------------------------------------------------------------------
 * [수동 검사 및 1초 복구 함수]
 * Apps Script 편집기 상단에서 'testRepairAndDiagnose'를 선택 후 [실행] 버튼을 누르면
 * 1) 스프레드시트의 깨진 JSON 행을 감지하여 구글 드라이브에 PDF 생성 및 열람 링크를 즉시 복구합니다.
 * 2) 완료 시 스프레드시트에 안내 토스트 알림을 띄웁니다.
 * ----------------------------------------------------------------------------
 */
function testRepairAndDiagnose() {
  Logger.log('=== [AIONE LAB] 자가 진단 및 복구 시작 ===');
  const folder = getApplicationDriveFolder();
  Logger.log('연결된 구글 드라이브 폴더: ' + folder.getName() + ' (ID: ' + folder.getId() + ')');

  repairBrokenRows();

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      ss.toast('✅ 기존 지원자의 드라이브 PDF 생성 및 열람 링크 복구가 완료되었습니다! (폴더: ' + folder.getName() + ')', 'AIONE LAB 복구 완료', 7);
    }
  } catch (_) {}

  Logger.log('=== [AIONE LAB] 자가 진단 및 복구 완료 ===');
}

/**
 * ----------------------------------------------------------------------------
 * [원클릭 드라이브 PDF 연동 자체 테스트 함수]
 * Apps Script 편집기 상단 함수 선택창에서 'testCreateDrivePdfDirectly'를 선택 후 [실행]을 누르면
 * 지정된 구글 드라이브 폴더에 즉시 테스트용 PDF를 1개 생성하여 연동 상태를 확인합니다.
 * ----------------------------------------------------------------------------
 */
function testCreateDrivePdfDirectly() {
  Logger.log('=== [AIONE LAB] 구글 드라이브 연동 직접 테스트 시작 ===');
  const folder = getApplicationDriveFolder();
  const testFileName = 'AIONE_연동확인테스트_' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss') + '.pdf';

  const testHtml = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: sans-serif; padding: 40px; text-align: center; color: #0f172a;">
        <h1 style="color: #0284c7; margin-bottom: 8px;">AIONE LAB 구글 드라이브 연동 테스트 성공!</h1>
        <p style="font-size: 14px; color: #334155;">이 PDF 파일이 구글 드라이브 폴더에 보인다면 시스템 연동이 100% 정상 작동 중입니다.</p>
        <div style="margin: 20px auto; padding: 15px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; max-width: 480px; text-align: left; font-size: 12px;">
          <p style="margin: 4px 0;"><strong>📁 저장 폴더명:</strong> ${folder.getName()}</p>
          <p style="margin: 4px 0;"><strong>🆔 폴더 ID:</strong> ${folder.getId()}</p>
          <p style="margin: 4px 0;"><strong>⏰ 생성 일시:</strong> ${Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy년 MM월 dd일 HH시 mm분 ss초')}</p>
        </div>
      </body>
    </html>
  `;

  let blob = null;
  try {
    blob = Utilities.newBlob(testHtml, 'text/html', 'test.html').getAs('application/pdf').setName(testFileName);
  } catch (_) {
    blob = HtmlService.createHtmlOutput(testHtml).getAs('application/pdf').setName(testFileName);
  }

  const file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (_) {}

  Logger.log('✅ 테스트 PDF 생성 성공: ' + file.getName());
  Logger.log('열람 URL: ' + file.getUrl());

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      ss.toast('🎉 [' + folder.getName() + '] 폴더에 테스트 PDF가 생성되었습니다! 드라이브를 확인하세요.', '드라이브 연동 성공', 6);
    }
  } catch (_) {}
}
