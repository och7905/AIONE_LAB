/**
 * AIONE LAB - Application Form Management & PDF Generation & Delivery System
 * 대전대학교 컴퓨터공학 인공지능 연구실 (AIONE LAB)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'aione_application_draft';
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mzeevple';
  const CONTACT_EMAIL = 'och7905@naver.com';

  // 구글 앱스 스크립트 웹앱 URL (배포 후 아래에 기입하면 PDF 파일이 och7905@naver.com 메일로 직접 첨부되어 100% 자동 발송됩니다)
  const GOOGLE_APPS_SCRIPT_URL = '';

  const form = document.getElementById('recruitment-form');
  if (!form) return;

  const submitBtn = document.getElementById('submit-btn');
  const submitBtnText = document.getElementById('submit-btn-text');
  const submitBtnSpinner = document.getElementById('submit-btn-spinner');
  const clearDraftBtn = document.getElementById('clear-draft-btn');

  // --------------------------------------------------------------------------
  // Character Counters (500자 & 200자 제한)
  // --------------------------------------------------------------------------
  const charLimitFields = [
    { id: 'motivation', limit: 500, counterId: 'counter-motivation' },
    { id: 'problem_solving', limit: 500, counterId: 'counter-problem_solving' },
    { id: 'study_plan', limit: 200, counterId: 'counter-study_plan' },
    { id: 'expectation', limit: 200, counterId: 'counter-expectation' },
    { id: 'career_plan', limit: 200, counterId: 'counter-career_plan' }
  ];

  charLimitFields.forEach(({ id, limit, counterId }) => {
    const textarea = document.getElementById(id);
    const counter = document.getElementById(counterId);

    if (textarea && counter) {
      const updateCount = () => {
        let currentLength = textarea.value.length;
        if (currentLength > limit) {
          textarea.value = textarea.value.substring(0, limit);
          currentLength = limit;
        }

        counter.textContent = `${currentLength} / ${limit}자`;

        if (currentLength >= limit) {
          counter.classList.add('at-limit');
          counter.classList.remove('near-limit');
        } else if (currentLength >= limit * 0.85) {
          counter.classList.add('near-limit');
          counter.classList.remove('at-limit');
        } else {
          counter.classList.remove('near-limit', 'at-limit');
        }
      };

      textarea.addEventListener('input', () => {
        updateCount();
        saveDraft();
      });

      updateCount();
    }
  });

  // --------------------------------------------------------------------------
  // Input Constraints & Auto-formatters (Student ID & Phone Number)
  // --------------------------------------------------------------------------
  
  // 1. Student ID constraint: Numbers only (최대 10자리, 영문/한글 완전 차단)
  const studentIdInput = document.getElementById('student_id');
  if (studentIdInput) {
    const sanitizeStudentId = () => {
      const digitsOnly = studentIdInput.value.replace(/[^0-9]/g, '').slice(0, 10);
      if (studentIdInput.value !== digitsOnly) {
        studentIdInput.value = digitsOnly;
      }
      saveDraft();
    };

    studentIdInput.addEventListener('keydown', (e) => {
      if (
        e.key === 'Backspace' ||
        e.key === 'Delete' ||
        e.key === 'Tab' ||
        e.key === 'Escape' ||
        e.key === 'Enter' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'Home' ||
        e.key === 'End' ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return;
      }
      if (e.key < '0' || e.key > '9') {
        e.preventDefault();
      }
    });

    ['input', 'keyup', 'change', 'blur', 'compositionend'].forEach(evt => {
      studentIdInput.addEventListener(evt, sanitizeStudentId);
    });

    studentIdInput.addEventListener('compositionupdate', sanitizeStudentId);
    studentIdInput.addEventListener('paste', () => setTimeout(sanitizeStudentId, 0));
  }

  // 2. Phone number auto-formatter: Numbers only & auto 010-XXXX-XXXX format
  const phoneInput = document.getElementById('phone');
  function formatKoreanPhone(value) {
    const raw = value.replace(/[^0-9]/g, '').slice(0, 11);
    if (!raw) return '';
    if (raw.length <= 3) {
      return raw;
    }
    if (raw.length <= 7) {
      return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    }
    return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
  }

  if (phoneInput) {
    const sanitizePhone = () => {
      const formatted = formatKoreanPhone(phoneInput.value);
      if (phoneInput.value !== formatted) {
        phoneInput.value = formatted;
      }
      saveDraft();
    };

    phoneInput.addEventListener('keydown', (e) => {
      if (
        e.key === 'Backspace' ||
        e.key === 'Delete' ||
        e.key === 'Tab' ||
        e.key === 'Escape' ||
        e.key === 'Enter' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'Home' ||
        e.key === 'End' ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return;
      }
      if (e.key < '0' || e.key > '9') {
        e.preventDefault();
      }
    });

    ['input', 'keyup', 'change', 'blur', 'compositionend'].forEach(evt => {
      phoneInput.addEventListener(evt, sanitizePhone);
    });

    phoneInput.addEventListener('compositionupdate', sanitizePhone);
    phoneInput.addEventListener('paste', () => setTimeout(sanitizePhone, 0));
  }

  // --------------------------------------------------------------------------
  // Selection Pills System (Tech Stack, Desired Activities, Interview Schedule)
  // --------------------------------------------------------------------------
  function setupPillGroup({ pillSelector, inputId, activeClass }) {
    const input = document.getElementById(inputId);
    const pills = document.querySelectorAll(pillSelector);
    if (!input || pills.length === 0) return { syncPills: () => {} };

    function getVals() {
      return input.value
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    }

    function syncPills() {
      const current = getVals().map(s => s.toLowerCase());
      pills.forEach(pill => {
        const val = (
          pill.getAttribute('data-tech') ||
          pill.getAttribute('data-activity') ||
          pill.getAttribute('data-schedule') ||
          pill.getAttribute('data-val') ||
          ''
        ).trim();

        if (val && current.includes(val.toLowerCase())) {
          pill.classList.add(activeClass);
        } else {
          pill.classList.remove(activeClass);
        }
      });
    }

    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const val = (
          pill.getAttribute('data-tech') ||
          pill.getAttribute('data-activity') ||
          pill.getAttribute('data-schedule') ||
          pill.getAttribute('data-val') ||
          ''
        ).trim();
        if (!val) return;

        let vals = getVals();
        const lower = val.toLowerCase();
        const existingIdx = vals.findIndex(v => v.toLowerCase() === lower);

        if (existingIdx >= 0) {
          vals.splice(existingIdx, 1);
        } else {
          vals.push(val);
        }

        input.value = vals.join(', ');
        syncPills();
        saveDraft();
      });
    });

    input.addEventListener('input', () => {
      syncPills();
      saveDraft();
    });

    return { syncPills };
  }

  const techPillsManager = setupPillGroup({
    pillSelector: '.tech-pill-btn',
    inputId: 'tech_stack',
    activeClass: 'is-active'
  });

  const activityPillsManager = setupPillGroup({
    pillSelector: '.activity-pill-btn',
    inputId: 'desired_activities',
    activeClass: 'is-active-emerald'
  });

  const interviewPillsManager = setupPillGroup({
    pillSelector: '.interview-pill-btn',
    inputId: 'interview_available_times',
    activeClass: 'is-active-purple'
  });

  function syncAllPills() {
    techPillsManager.syncPills();
    activityPillsManager.syncPills();
    interviewPillsManager.syncPills();
  }

  // --------------------------------------------------------------------------
  // LocalStorage Auto-Draft Autosave & Restore
  // --------------------------------------------------------------------------
  let saveTimeout = null;
  function saveDraft() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      const formData = collectFormData();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
        showDraftIndicator();
      } catch (err) {
        console.warn('LocalStorage save failed:', err);
      }
    }, 400);
  }

  function showDraftIndicator() {
    const indicator = document.getElementById('draft-saved-indicator');
    if (indicator) {
      indicator.classList.remove('opacity-0');
      setTimeout(() => {
        indicator.classList.add('opacity-0');
      }, 1500);
    }
  }

  function restoreDraft() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const data = JSON.parse(saved);

      let restoredAny = false;
      Object.keys(data).forEach(key => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) {
          if (input.type === 'radio') {
            const radio = form.querySelector(`[name="${key}"][value="${data[key]}"]`);
            if (radio) {
              radio.checked = true;
              restoredAny = true;
            }
          } else {
            if (data[key]) {
              input.value = data[key];
              restoredAny = true;
            }
          }
        }
      });

      if (restoredAny) {
        charLimitFields.forEach(({ id, limit, counterId }) => {
          const textarea = document.getElementById(id);
          const counter = document.getElementById(counterId);
          if (textarea && counter) {
            counter.textContent = `${textarea.value.length} / ${limit}자`;
          }
        });

        if (studentIdInput && studentIdInput.value) {
          studentIdInput.value = studentIdInput.value.replace(/[^0-9]/g, '').slice(0, 10);
        }
        if (phoneInput && phoneInput.value) {
          phoneInput.value = formatKoreanPhone(phoneInput.value);
        }

        syncAllPills();
        window.showToast?.('✍️ 이전에 작성 중이던 지원서 내용이 자동 복원되었습니다.');
      }
    } catch (err) {
      console.warn('Failed to restore draft from LocalStorage:', err);
    }
  }

  // Clear draft
  if (clearDraftBtn) {
    clearDraftBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('작성 중인 모든 임시 저장 내용을 초기화하시겠습니까?')) {
        localStorage.removeItem(STORAGE_KEY);
        form.reset();
        charLimitFields.forEach(({ limit, counterId }) => {
          const counter = document.getElementById(counterId);
          if (counter) counter.textContent = `0 / ${limit}자`;
        });
        syncAllPills();
        window.showToast?.('🗑️ 지원서 내용이 초기화되었습니다.');
      }
    });
  }

  // Form input listeners for draft saving
  form.querySelectorAll('input, select, textarea').forEach(element => {
    element.addEventListener('change', saveDraft);
    if (element.tagName !== 'TEXTAREA') {
      element.addEventListener('input', saveDraft);
    }
  });

  // --------------------------------------------------------------------------
  // Data Collection & JSON Backup Download
  // --------------------------------------------------------------------------
  function collectFormData() {
    const rawData = new FormData(form);
    const data = {};
    for (const [key, value] of rawData.entries()) {
      data[key] = value.trim();
    }
    return data;
  }

  function downloadBackupJSON(data) {
    const studentId = data.student_id || '학번미입력';
    const name = data.name || '지원자';
    const timestamp = new Date().toISOString();

    const backupPayload = {
      title: "AIONE LAB 2026학년도 신규 연구원 지원서 백업본",
      laboratory: "대전대학교 컴퓨터공학 인공지능 연구실 (AIONE LAB)",
      submitted_at: timestamp,
      applicant_info: {
        name: data.name,
        student_id: data.student_id,
        grade: data.grade,
        phone: data.phone,
        military: data.military
      },
      application_content: {
        keyword_intro: data.keyword_intro,
        motivation: data.motivation,
        problem_solving: data.problem_solving,
        study_plan: data.study_plan,
        expectation: data.expectation,
        career_plan: data.career_plan,
        tech_stack: data.tech_stack,
        desired_activities: data.desired_activities,
        interview_available_times: data.interview_available_times,
        portfolio_links: data.portfolio_links
      }
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `AIONE_지원서_${studentId}_${name}.json`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
  }

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // PDF Generation System (Official Form Template via html2pdf)
  // --------------------------------------------------------------------------
  async function generateApplicationPDF(data) {
    const wrapper = document.getElementById('pdf-render-wrapper');
    const template = document.getElementById('pdf-application-template');
    if (!template || !wrapper) return null;

    try {
      // 1. Populate text fields for both Page 1 and Page 2
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '-';
      };

      setVal('pdf-val-date', new Date().toLocaleString('ko-KR'));
      setVal('pdf-val-name', data.name);
      setVal('pdf-val-student-id', data.student_id);
      setVal('pdf-val-grade', data.grade);
      setVal('pdf-val-phone', data.phone);
      setVal('pdf-val-military', data.military);

      setVal('pdf-val-tech', data.tech_stack || '없음');
      setVal('pdf-val-activity', data.desired_activities || '없음');
      setVal('pdf-val-interview', data.interview_available_times);
      setVal('pdf-val-portfolio', data.portfolio_links || '없음');

      setVal('pdf-val-keyword', data.keyword_intro);
      setVal('pdf-val-motivation', data.motivation);

      // Page 2 header & fields
      setVal('pdf-val-page2-name', data.name);
      setVal('pdf-val-page2-student-id', data.student_id);

      setVal('pdf-val-problem', data.problem_solving);
      setVal('pdf-val-study', data.study_plan);
      setVal('pdf-val-expectation', data.expectation);
      setVal('pdf-val-career', data.career_plan);

      const now = new Date();
      setVal('pdf-val-sign-date', `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`);
      setVal('pdf-val-sign-name', data.name);

      const filename = `AIONE_2026_지원서_${data.student_id}_${data.name}.pdf`;

      // 2. Position template at top-left behind webpage content for clean rendering
      wrapper.style.display = 'block';
      wrapper.style.position = 'absolute';
      wrapper.style.top = '0px';
      wrapper.style.left = '0px';
      wrapper.style.zIndex = '-99999';
      wrapper.style.opacity = '1';

      // Allow 200ms for browser to render layout and fonts
      await new Promise(resolve => setTimeout(resolve, 200));

      let pdfBlob = null;
      if (typeof html2pdf !== 'undefined') {
        const opt = {
          margin: [8, 8, 8, 8],
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: {
            mode: ['css', 'legacy'],
            before: '.html2pdf__page-break'
          }
        };

        // Render PDF directly to user's download folder
        await html2pdf().set(opt).from(template).save();

        // Obtain Blob if Google Apps Script attachment is enabled
        if (GOOGLE_APPS_SCRIPT_URL) {
          pdfBlob = await html2pdf().set(opt).from(template).output('blob');
        }
      }

      // Hide wrapper again
      wrapper.style.display = 'none';
      return { filename, pdfBlob };
    } catch (err) {
      console.error('PDF generation error:', err);
      if (wrapper) wrapper.style.display = 'none';
    }
    return null;
  }

  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  }

  // --------------------------------------------------------------------------
  // Form Submission & Multi-Channel Delivery (Formspree + PDF Generation)
  // --------------------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = collectFormData();

    // 1. Loading state: Generating PDF and sending notification
    setLoadingState(true, '지원서 공식 양식 PDF 생성 및 전송 중...');

    // 2. Construct robust Formspree payload with sender email & clean keys
    const emailSubject = `[AIONE LAB 2026 연구원 지원서] ${data.name} (${data.student_id} / ${data.grade})`;
    const formspreePayload = {
      _subject: emailSubject,
      email: CONTACT_EMAIL,
      _replyto: CONTACT_EMAIL,
      applicant_name: data.name,
      applicant_id: data.student_id,
      applicant_grade: data.grade,
      applicant_phone: data.phone,
      applicant_military: data.military,
      "1_성명": data.name,
      "2_학번": data.student_id,
      "3_지원구분_학년": data.grade,
      "4_연락처": data.phone,
      "5_병역구분": data.military,
      "6_나를_표현하는_단어_이유": data.keyword_intro,
      "7_지원동기": data.motivation,
      "8_문제해결경험": data.problem_solving,
      "9_학업계획": data.study_plan,
      "10_얻고자하는것": data.expectation,
      "11_진로계획": data.career_plan,
      "12_기술스택_경험": data.tech_stack || "없음",
      "13_연구실_희망활동": data.desired_activities || "없음",
      "14_면접가능시간": data.interview_available_times,
      "15_포트폴리오링크": data.portfolio_links || "없음",
      "16_공식_지원서_PDF": `AIONE_2026_지원서_${data.student_id}_${data.name}.pdf (지원자 PC 다운로드 완료)`,
      "17_접수일시": new Date().toLocaleString('ko-KR')
    };

    try {
      // Step A & Step B: Concurrent execution of Formspree email dispatch & PDF generation
      const formspreePromise = fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formspreePayload)
      }).then(async (res) => {
        console.log('Formspree response status:', res.status);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn('Formspree response warning:', errData);
        }
        return res;
      }).catch((err) => {
        console.warn('Formspree network warning:', err);
        return null;
      });

      const pdfPromise = generateApplicationPDF(data);

      const [formspreeRes, pdfResult] = await Promise.all([formspreePromise, pdfPromise]);

      // Step C. If Google Apps Script WebApp is configured, send actual PDF attachment
      if (GOOGLE_APPS_SCRIPT_URL && pdfResult?.pdfBlob) {
        try {
          const pdfBase64 = await blobToBase64(pdfResult.pdfBlob);
          fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...data,
              pdfBase64: pdfBase64,
              filename: pdfResult.filename
            })
          }).catch((gasErr) => console.warn('Google Apps Script warning:', gasErr));
        } catch (gasErr) {
          console.warn('Google Apps Script submission warning:', gasErr);
        }
      }

      // Complete submission
      localStorage.removeItem(STORAGE_KEY);
      downloadBackupJSON(data);
      showSuccessModal(data);
      form.reset();
      charLimitFields.forEach(({ limit, counterId }) => {
        const counter = document.getElementById(counterId);
        if (counter) counter.textContent = `0 / ${limit}자`;
      });
      syncAllPills();

    } catch (error) {
      console.error('Submission failed:', error);
      handleSubmissionError(data, error);
    } finally {
      setLoadingState(false);
    }
  });

  function setLoadingState(isLoading, customText) {
    if (isLoading) {
      submitBtn.disabled = true;
      submitBtnText.textContent = customText || '지원서 전송 중...';
      submitBtnSpinner.classList.remove('hidden');
    } else {
      submitBtn.disabled = false;
      submitBtnText.textContent = '🚀 지원서 공식 접수하기';
      submitBtnSpinner.classList.add('hidden');
    }
  }

  // --------------------------------------------------------------------------
  // Modals & Fallback Logic
  // --------------------------------------------------------------------------
  function showSuccessModal(data) {
    const modal = document.getElementById('success-modal');
    const modalApplicantName = document.getElementById('modal-applicant-name');
    const mailtoPdfBtn = document.getElementById('modal-mailto-pdf-btn');

    if (modalApplicantName) {
      modalApplicantName.textContent = `${data.name} (${data.student_id}) 님`;
    }

    if (mailtoPdfBtn) {
      const filename = `AIONE_2026_지원서_${data.student_id}_${data.name}.pdf`;
      const subject = encodeURIComponent(`[AIONE LAB 신규 지원서 PDF 전달] ${data.name} (${data.student_id} / ${data.grade})`);
      const body = encodeURIComponent(
        `안녕하세요, AIONE LAB 지도교수님 및 랩장님.\n\n` +
        `2026학년도 연구원 지원자 ${data.name} (${data.student_id} / ${data.grade})입니다.\n\n` +
        `웹사이트 지원서 접수 완료 후 공식 생성된 지원서 양식 PDF 파일(${filename})을 첨부하여 발송해 드립니다.\n\n` +
        `[지원자 연락처]\n` +
        `- 전화번호: ${data.phone}\n` +
        `- 포트폴리오 링크: ${data.portfolio_links || '없음'}\n\n` +
        `감사합니다.\n` +
        `${data.name} 드림`
      );
      mailtoPdfBtn.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    }

    if (modal) {
      modal.classList.add('active');
    }
  }

  function handleSubmissionError(data, error) {
    downloadBackupJSON(data);

    const errorModal = document.getElementById('error-modal');
    const mailtoBtn = document.getElementById('error-mailto-btn');

    if (mailtoBtn) {
      const subject = encodeURIComponent(`[AIONE LAB 지원서 수동 제출] ${data.name} (${data.student_id})`);
      const body = encodeURIComponent(
        `안녕하세요, AIONE LAB 2026 연구원 지원자 ${data.name}입니다.\n\n` +
        `웹 전송 네트워크 오류로 인해 직접 이메일로 지원서를 전송합니다.\n\n` +
        `[지원자 정보]\n` +
        `- 이름: ${data.name}\n` +
        `- 학번: ${data.student_id}\n` +
        `- 학년: ${data.grade}\n` +
        `- 연락처: ${data.phone}\n` +
        `- 병역: ${data.military}\n\n` +
        `[본인을 표현하는 단어]:\n${data.keyword_intro}\n\n` +
        `[지원 동기]:\n${data.motivation}\n\n` +
        `[문제 해결 경험]:\n${data.problem_solving}\n\n` +
        `[학업 계획]:\n${data.study_plan}\n\n` +
        `[얻고자 하는 것]:\n${data.expectation}\n\n` +
        `[졸업 후 진로]:\n${data.career_plan}\n\n` +
        `[기술 스택]:\n${data.tech_stack}\n\n` +
        `[연구실 희망 활동]:\n${data.desired_activities}\n\n` +
        `[면접 가능 시간대]:\n${data.interview_available_times}\n\n` +
        `[포트폴리오 링크]:\n${data.portfolio_links}\n\n` +
        `(다운로드된 지원서 PDF 파일을 본 메일에 첨부 부탁드립니다)`
      );

      mailtoBtn.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    }

    if (errorModal) {
      errorModal.classList.add('active');
    }
  }

  // Auto-restore draft on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    restoreDraft();
  });
})();
