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

// 2. 알림 수신 랩장 이메일 주소
const NOTIFICATION_EMAIL = 'och7905@naver.com';

// 3. 관리자 기본 비밀번호 SHA-256 단방향 암호화 해시 (복호화 불가, 평문 미노출)
const DEFAULT_ADMIN_PASSWORD_HASH = '3940070561060ddc20164314c9dfa5b43b7c8abce3118e839a6583e7ae13a13c';

// 4. 스프레드시트 시트 이름
const SHEET_NAME = '지원자명단';


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

    // Step A. 정식 규격 지원서 HTML 문서 구성
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

    // Step B. HTML -> Blob -> PDF 바이너리 변환
    const pdfBlob = HtmlService.createHtmlOutput(htmlTemplate)
      .getAs('application/pdf')
      .setName('AIONE_지원서_' + studentId + '_' + name + '.pdf');

    // Step C. 구글 드라이브 지정 폴더에 PDF 저장
    let driveFolder;
    try {
      driveFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    } catch (folderErr) {
      driveFolder = DriveApp.getRootFolder();
    }
    const pdfFile = driveFolder.createFile(pdfBlob);

    // 열람 권한: 링크가 있는 모든 사용자 열람 가능
    try {
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (_) {}

    const pdfUrl = pdfFile.getUrl();

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

  // 2. 관리자 지원자 전체 목록 조회
  if (action === 'get_applicants') {
    const enteredPw = (e.parameter.pw || '').trim();
    if (!verifyAdminPassword(enteredPw)) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '관리자 인증 실패'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const applicants = fetchApplicantsFromSheet();
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      applicants: applicants
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 3. 관리자 비밀번호 변경
  if (action === 'change_password') {
    const oldPw = (e.parameter.old_pw || '').trim();
    const newPw = (e.parameter.new_pw || '').trim();

    if (!verifyAdminPassword(oldPw)) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '현재 비밀번호가 일치하지 않습니다.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!newPw) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '새 비밀번호를 입력해주세요.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const newHash = computeSha256(newPw);
    PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD_HASH', newHash);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: '비밀번호가 성공적으로 변경되었습니다.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 4. 관리자 특정 지원서 삭제
  if (action === 'delete_applicant') {
    const enteredPw = (e.parameter.pw || '').trim();
    if (!verifyAdminPassword(enteredPw)) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '관리자 인증 실패'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const targetStudentId = (e.parameter.student_id || '').trim();
    const targetName = (e.parameter.name || '').trim();

    const deleted = deleteApplicantFromSheet(targetStudentId, targetName);
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

  MailApp.sendEmail({
    to: NOTIFICATION_EMAIL,
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
        display: flex;
        justify-content: space-between;
        align-items: center;
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
          <div style="font-size: 9.5px; color: #64748b;">학부연구생 6기(예비 2학년) 및 석사과정 연구원 선발</div>
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

    <div class="footer-note">
      <span>대전대학교 서문 방면 융합과학관 217호 &amp; 330호 (전승현 지도교수 / 오창현 랩장)</span>
      <span>AIONE LAB 2026 OFFICIAL FORM</span>
    </div>
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

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // 시트 헤더 초기화
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
      '구글드라이브PDF링크'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#0284c7')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendApplicantToSheet(item) {
  try {
    const sheet = getTargetSheet();
    if (!sheet) return;

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
      item.pdfUrl
    ]);
  } catch (err) {
    Logger.log('Spreadsheet appendRow warning: ' + err);
  }
}

function fetchApplicantsFromSheet() {
  try {
    const sheet = getTargetSheet();
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
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
        pdf_url: row[16] ? String(row[16]) : ''
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

    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

    for (let i = 0; i < data.length; i++) {
      const rowName = String(data[i][1] || '').trim();
      const rowId = String(data[i][2] || '').trim();

      if (rowId === studentId || (name && rowName === name)) {
        sheet.deleteRow(i + 2);
        return true;
      }
    }
    return false;
  } catch (err) {
    Logger.log('deleteApplicantFromSheet error: ' + err);
    return false;
  }
}

function verifyAdminPassword(entered) {
  if (!entered) return false;
  const enteredHash = computeSha256(entered);
  const storedHash = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH') || DEFAULT_ADMIN_PASSWORD_HASH;
  return enteredHash === storedHash || entered === storedHash;
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
