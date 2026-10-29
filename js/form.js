/**
 * AIONE LAB - Application Form Management & PDF Generation & Delivery System
 * 대전대학교 컴퓨터공학 인공지능 연구실 (AIONE LAB)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'aione_application_draft';
  const ADMIN_STORAGE_KEY = 'aione_admin_submissions';
  
  // ==========================================================================
  // Google Apps Script (GAS) Web App URL
  // 구글 앱스 스크립트 배포 후 발급받은 웹앱 URL을 아래 따옴표 안에 입력해 주시거나,
  // 웹사이트 관리자 포털 설정창에서 등록하면 자동으로 연동됩니다.
  // ==========================================================================
  const GAS_WEBAPP_URL = "여기에_배포된_GAS_URL_입력";
  const CONTACT_EMAIL = "och7905@naver.com";

  // 활성화된 GAS URL 취득 (관리자 포털 설정값 우선)
  const getGasUrl = () => {
    const saved = localStorage.getItem('aione_gas_url');
    if (saved && saved.startsWith('http')) return saved;
    return GAS_WEBAPP_URL;
  };

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
  // PDF Generation System (Official Form Template - Exact 2-Page Zero Clipping)
  // --------------------------------------------------------------------------
  async function generateApplicationPDF(data) {
    const wrapper = document.getElementById('pdf-render-wrapper');
    const page1 = document.getElementById('pdf-page-1');
    const page2 = document.getElementById('pdf-page-2');
    if (!wrapper || !page1 || !page2) {
      console.error('PDF template elements not found in DOM');
      return null;
    }

    // Save previous scroll position and body layout styles
    const prevScrollX = window.scrollX || window.pageXOffset || 0;
    const prevScrollY = window.scrollY || window.pageYOffset || 0;
    const prevBodyMinWidth = document.body.style.minWidth;
    const prevBodyOverflowX = document.body.style.overflowX;

    try {
      // 1. Populate text fields for both Page 1 and Page 2
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '-';
      };

      const now = new Date();
      const dateStr = `${now.getFullYear()}. ${String(now.getMonth() + 1).padStart(2, '0')}. ${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      setVal('pdf-val-date', dateStr);
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

      setVal('pdf-val-sign-date', `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`);
      setVal('pdf-val-sign-name', data.name);

      const filename = `AIONE_지원서_${data.student_id}_${data.name}.pdf`;

      // 2. Normalize viewport & body to eliminate any coordinate displacement or mobile clipping
      window.scrollTo(0, 0);
      document.body.style.minWidth = '794px';
      document.body.style.overflowX = 'visible';

      // 3. Position wrapper cleanly at the top-left origin (width 794px fixed)
      wrapper.style.display = 'block';
      wrapper.style.position = 'absolute';
      wrapper.style.top = '0px';
      wrapper.style.left = '0px';
      wrapper.style.width = '794px';
      wrapper.style.minWidth = '794px';
      wrapper.style.maxWidth = '794px';
      wrapper.style.margin = '0px';
      wrapper.style.padding = '0px';
      wrapper.style.zIndex = '999999';
      wrapper.style.opacity = '1';
      wrapper.style.background = '#ffffff';

      // Capture options for pixel-perfect A4 96DPI -> 2x scale = 1588 x 2246 (zero clipping)
      const canvasOptions = {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          clonedDoc.documentElement.style.width = '794px';
          clonedDoc.documentElement.style.minWidth = '794px';
          clonedDoc.documentElement.style.overflow = 'visible';
          clonedDoc.body.style.width = '794px';
          clonedDoc.body.style.minWidth = '794px';
          clonedDoc.body.style.overflow = 'visible';
          clonedDoc.body.style.overflowX = 'visible';
          clonedDoc.body.style.margin = '0';
          clonedDoc.body.style.padding = '0';
          const clonedWrapper = clonedDoc.getElementById('pdf-render-wrapper');
          if (clonedWrapper) {
            clonedWrapper.style.display = 'block';
            clonedWrapper.style.position = 'static';
            clonedWrapper.style.margin = '0';
            clonedWrapper.style.padding = '0';
            clonedWrapper.style.width = '794px';
            clonedWrapper.style.minWidth = '794px';
          }
        }
      };

      const html2canvasFunc = window.html2canvas;
      const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;

      let pdfBlob = null;

      if (html2canvasFunc && jsPDFClass) {
        // Step A: Capture Page 1 (isolated at top 0)
        page1.style.display = 'block';
        page2.style.display = 'none';
        await new Promise(resolve => setTimeout(resolve, 150));
        const canvas1 = await html2canvasFunc(page1, canvasOptions);

        // Step B: Capture Page 2 (isolated at top 0)
        page1.style.display = 'none';
        page2.style.display = 'block';
        await new Promise(resolve => setTimeout(resolve, 150));
        const canvas2 = await html2canvasFunc(page2, canvasOptions);

        // Restore DOM state
        page1.style.display = 'block';
        page2.style.display = 'block';
        wrapper.style.display = 'none';
        document.body.style.minWidth = prevBodyMinWidth;
        document.body.style.overflowX = prevBodyOverflowX;
        window.scrollTo(prevScrollX, prevScrollY);

        // Step C: Assemble 2-page PDF via jsPDF (Universal positional constructor)
        const doc = new jsPDFClass('portrait', 'mm', 'a4');

        // Add Page 1 (Full bleed A4: 210mm x 297mm)
        const img1 = canvas1.toDataURL('image/jpeg', 0.98);
        doc.addImage(img1, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

        // Add Page 2 (Full bleed A4: 210mm x 297mm)
        doc.addPage('a4', 'portrait');
        const img2 = canvas2.toDataURL('image/jpeg', 0.98);
        doc.addImage(img2, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

        // Extract Blob
        pdfBlob = doc.output('blob');

        // Step D: Trigger instant download to applicant PC (Multi-browser safe)
        try {
          doc.save(filename);
        } catch (saveErr) {
          console.warn('doc.save fallback to blob anchor:', saveErr);
          const blobUrl = URL.createObjectURL(pdfBlob);
          const anchor = document.createElement('a');
          anchor.href = blobUrl;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          setTimeout(() => {
            document.body.removeChild(anchor);
            URL.revokeObjectURL(blobUrl);
          }, 2000);
        }

      } else if (typeof html2pdf !== 'undefined') {
        page1.style.display = 'block';
        page2.style.display = 'block';
        wrapper.style.display = 'block';
        window.scrollTo(0, 0);

        const template = document.getElementById('pdf-application-template');
        const opt = {
          margin: 0,
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 794, width: 794, x: 0, y: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        const worker = html2pdf().set(opt).from(template);
        await worker.save();
        try {
          pdfBlob = await worker.output('blob');
        } catch (bErr) {}
        wrapper.style.display = 'none';
        document.body.style.minWidth = prevBodyMinWidth;
        document.body.style.overflowX = prevBodyOverflowX;
        window.scrollTo(prevScrollX, prevScrollY);
      } else {
        throw new Error('No PDF generation library (html2canvas / jsPDF / html2pdf) available in global scope.');
      }

      return { filename, pdfBlob };
    } catch (err) {
      console.error('PDF generation error:', err);
      if (wrapper) wrapper.style.display = 'none';
      if (page1) page1.style.display = 'block';
      if (page2) page2.style.display = 'block';
      document.body.style.minWidth = prevBodyMinWidth;
      document.body.style.overflowX = prevBodyOverflowX;
      window.scrollTo(prevScrollX, prevScrollY);
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Applicant Data Encoding & Online Viewing Link Generation (URL-Safe)
  // --------------------------------------------------------------------------
  async function createApplicantViewerLink(data) {
    try {
      const compact = {
        n: data.name || '',
        i: data.student_id || '',
        g: data.grade || '',
        p: data.phone || '',
        m: data.military || '',
        t: data.tech_stack || '',
        a: data.desired_activities || '',
        v: data.interview_available_times || '',
        l: data.portfolio_links || '',
        k: data.keyword_intro || '',
        o: data.motivation || '',
        s: data.problem_solving || '',
        u: data.study_plan || '',
        e: data.expectation || '',
        c: data.career_plan || '',
        d: new Date().toLocaleString('ko-KR')
      };

      const jsonStr = JSON.stringify(compact);
      let encodedPayload = '';

      // Try modern CompressionStream (deflate) to compress down to ~400-600 bytes
      if (typeof CompressionStream !== 'undefined') {
        try {
          const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('deflate'));
          const buffer = await new Response(stream).arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          encodedPayload = 'z_' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        } catch (_) {}
      }

      // Fallback to standard Base64 if CompressionStream is not available
      if (!encodedPayload) {
        const utf8Bytes = new TextEncoder().encode(jsonStr);
        let binary = '';
        for (let idx = 0; idx < utf8Bytes.length; idx++) {
          binary += String.fromCharCode(utf8Bytes[idx]);
        }
        encodedPayload = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }

      // Determine robust base URL (fallback to official GitHub Pages URL if testing on local file)
      let baseUrl = 'https://och7905.github.io/AIONE_LAB/';
      if (window.location.protocol.startsWith('http') && !window.location.hostname.includes('localhost')) {
        baseUrl = window.location.origin + window.location.pathname;
        baseUrl = baseUrl.split('?')[0].split('#')[0];
        if (!baseUrl.endsWith('/') && !baseUrl.endsWith('.html')) {
          baseUrl += '/';
        }
      }

      return `${baseUrl}?view_app=${encodedPayload}`;
    } catch (err) {
      console.error('Failed to create viewer link:', err);
      return `https://och7905.github.io/AIONE_LAB/?applicant=${encodeURIComponent(data.name)}`;
    }
  }

  async function decodeApplicantData(raw) {
    try {
      if (!raw) return null;
      let jsonStr = '';

      if (raw.startsWith('z_')) {
        // Decompress deflate
        try {
          const cleanB64 = raw.slice(2).replace(/-/g, '+').replace(/_/g, '/');
          let padded = cleanB64;
          while (padded.length % 4 !== 0) padded += '=';
          const binary = atob(padded);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          if (typeof DecompressionStream !== 'undefined') {
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
            jsonStr = await new Response(stream).text();
          }
        } catch (_) {}
      }

      if (!jsonStr) {
        // Standard Base64 decode
        const clean = raw.startsWith('z_') ? raw.slice(2) : raw;
        let base64 = clean.replace(/-/g, '+').replace(/_/g, '/').replace(/ /g, '+');
        while (base64.length % 4 !== 0) base64 += '=';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let idx = 0; idx < binary.length; idx++) bytes[idx] = binary.charCodeAt(idx);
        jsonStr = new TextDecoder().decode(bytes);
      }

      const compact = JSON.parse(jsonStr);

      return {
        name: compact.n || compact.name || '',
        student_id: compact.i || compact.student_id || '',
        grade: compact.g || compact.grade || '',
        phone: compact.p || compact.phone || '',
        military: compact.m || compact.military || '',
        tech_stack: compact.t || compact.tech_stack || '',
        desired_activities: compact.a || compact.desired_activities || '',
        interview_available_times: compact.v || compact.interview_available_times || '',
        portfolio_links: compact.l || compact.portfolio_links || '',
        keyword_intro: compact.k || compact.keyword_intro || '',
        motivation: compact.o || compact.motivation || '',
        problem_solving: compact.s || compact.problem_solving || '',
        study_plan: compact.u || compact.study_plan || '',
        expectation: compact.e || compact.expectation || '',
        career_plan: compact.c || compact.career_plan || '',
        submit_date: compact.d || compact.submit_date || ''
      };
    } catch (err) {
      console.error('Failed to decode applicant data:', err);
      return null;
    }
  }

  function openApplicantViewerModal(data) {
    const modal = document.getElementById('applicant-viewer-modal');
    const headerInfo = document.getElementById('viewer-header-info');
    const container = document.getElementById('viewer-paper-container');
    const downloadBtn = document.getElementById('viewer-download-pdf-btn');
    const printBtn = document.getElementById('viewer-print-btn');
    const closeBtn = document.getElementById('viewer-close-btn');

    if (!modal || !container) return;

    if (headerInfo) {
      headerInfo.textContent = `지원자: ${data.name} (${data.student_id} / ${data.grade} / ${data.phone})`;
    }

    // Populate the hidden template elements first
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '-';
    };

    setVal('pdf-val-date', data.submit_date || new Date().toLocaleString('ko-KR'));
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

    setVal('pdf-val-page2-name', data.name);
    setVal('pdf-val-page2-student-id', data.student_id);
    setVal('pdf-val-problem', data.problem_solving);
    setVal('pdf-val-study', data.study_plan);
    setVal('pdf-val-expectation', data.expectation);
    setVal('pdf-val-career', data.career_plan);

    setVal('pdf-val-sign-date', `${new Date().getFullYear()}년 ${new Date().getMonth() + 1}월 ${new Date().getDate()}일`);
    setVal('pdf-val-sign-name', data.name);

    // Clone pages into viewer container with paper shadow
    const page1 = document.getElementById('pdf-page-1');
    const page2 = document.getElementById('pdf-page-2');

    container.innerHTML = '';
    if (page1 && page2) {
      const clone1 = page1.cloneNode(true);
      clone1.id = 'viewer-clone-page-1';
      clone1.style.display = 'block';
      clone1.style.boxShadow = '0 20px 40px -15px rgba(0,0,0,0.7), 0 0 15px rgba(0,0,0,0.4)';
      clone1.style.borderRadius = '2px';
      clone1.style.width = '794px';
      clone1.style.height = '1123px';
      clone1.style.background = '#ffffff';

      const clone2 = page2.cloneNode(true);
      clone2.id = 'viewer-clone-page-2';
      clone2.style.display = 'block';
      clone2.style.boxShadow = '0 20px 40px -15px rgba(0,0,0,0.7), 0 0 15px rgba(0,0,0,0.4)';
      clone2.style.borderRadius = '2px';
      clone2.style.width = '794px';
      clone2.style.height = '1123px';
      clone2.style.background = '#ffffff';

      // Responsive mobile scale (< 820px)
      const isMobile = window.innerWidth < 820;
      if (isMobile) {
        const availableWidth = Math.max(300, window.innerWidth - 48);
        const scale = availableWidth / 794;
        clone1.style.transform = `scale(${scale})`;
        clone1.style.transformOrigin = 'top center';
        clone1.style.marginBottom = `${-(1123 * (1 - scale))}px`;

        clone2.style.transform = `scale(${scale})`;
        clone2.style.transformOrigin = 'top center';
        clone2.style.marginBottom = `${-(1123 * (1 - scale))}px`;
      }

      container.appendChild(clone1);
      container.appendChild(clone2);
    }

    // Bind action buttons
    if (downloadBtn) {
      downloadBtn.onclick = async () => {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>PDF 생성 및 다운로드 중...</span>';
        await generateApplicationPDF(data);
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="fa-solid fa-file-arrow-down"></i><span>공식 PDF 다운로드</span>';
      };
    }

    if (printBtn) {
      printBtn.onclick = () => window.print();
    }

    if (closeBtn) {
      closeBtn.onclick = () => modal.classList.remove('active');
    }

    modal.classList.add('active');
  }

  async function checkAndOpenViewer() {
    try {
      let raw = '';
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.has('view_app')) {
        raw = searchParams.get('view_app');
      } else if (window.location.hash) {
        const hashStr = window.location.hash.replace(/^#\/?/, '');
        const hashParams = new URLSearchParams(hashStr);
        if (hashParams.has('view_app')) {
          raw = hashParams.get('view_app');
        }
      }

      if (raw) {
        const data = await decodeApplicantData(raw);
        if (data && (data.name || data.student_id)) {
          openApplicantViewerModal(data);

          // If direct auto-download is requested via URL parameter
          const wantsDownload = searchParams.get('download_pdf') === '1' || window.location.href.includes('download_pdf=1');
          if (wantsDownload) {
            window.showToast?.('📥 지원서 공식 PDF 다운로드를 시작합니다...');
            setTimeout(() => {
              generateApplicationPDF(data);
            }, 600);
          }
        }
      }
    } catch (err) {
      console.warn('Applicant viewer check warning:', err);
    }
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
  // Form Submission & Multi-Channel Delivery (Google Apps Script Webhook + PDF Auto Download)
  // --------------------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = collectFormData();

    // 1. Loading state: 버튼 비활성화 및 텍스트 변경
    setLoadingState(true, '지원서 PDF 생성 및 드라이브 저장 중...');

    try {
      // 2. 브라우저에서 지원자 보관용 2-Page 공식 규격 PDF 자동 생성 및 즉시 다운로드 (AIONE_지원서_{학번}_{성명}.pdf)
      let pdfBase64 = '';
      try {
        const pdfResult = await generateApplicationPDF(data);
        if (pdfResult && pdfResult.pdfBlob) {
          pdfBase64 = await blobToBase64(pdfResult.pdfBlob);
        }
      } catch (pdfErr) {
        console.error('Local PDF generation warning:', pdfErr);
      }

      // 3. 백엔드(Google Apps Script Web App)로 지원서 데이터 + PDF 바이너리 비동기 전송
      const targetGasUrl = getGasUrl();
      if (targetGasUrl && targetGasUrl !== "여기에_배포된_GAS_URL_입력") {
        try {
          const payload = {
            ...data,
            pdf_base64: pdfBase64,
            submitted_at: new Date().toLocaleString('ko-KR')
          };
          await fetch(targetGasUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
        } catch (gasErr) {
          console.warn("Google Apps Script Webhook warning (no-cors expected):", gasErr);
        }
      }

      // 4. 로컬 관리자 스토리지에도 안전 보관
      saveToAdminLocalStorage(data);

      // 5. 임시 저장 데이터 정리 및 폼 초기화
      localStorage.removeItem(STORAGE_KEY);
      downloadBackupJSON(data);
      form.reset();
      charLimitFields.forEach(({ limit, counterId }) => {
        const counter = document.getElementById(counterId);
        if (counter) counter.textContent = `0 / ${limit}자`;
      });
      syncAllPills();

      // 6. 성공 모달 표시
      showSuccessModal(data);

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
  // Modals
  // --------------------------------------------------------------------------
  function showSuccessModal(data) {
    const modal = document.getElementById('success-modal');
    const modalApplicantName = document.getElementById('modal-applicant-name');

    if (modalApplicantName) {
      modalApplicantName.textContent = `${data.name} (${data.student_id}) 님`;
    }

    if (modal) {
      modal.classList.add('active');
    }
  }

  function handleSubmissionError(data, error) {
    downloadBackupJSON(data);
    const errorModal = document.getElementById('error-modal');
    if (errorModal) {
      errorModal.classList.add('active');
    }
  }

  // --------------------------------------------------------------------------
  // Admin Local Storage Persistence
  // --------------------------------------------------------------------------
  function saveToAdminLocalStorage(data) {
    try {
      const list = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || '[]');
      const itemToSave = {
        ...data,
        submitted_at: data.submitted_at || new Date().toLocaleString('ko-KR')
      };
      const existingIndex = list.findIndex(item => item.student_id === data.student_id);
      if (existingIndex >= 0) {
        list[existingIndex] = itemToSave;
      } else {
        list.unshift(itemToSave);
      }
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('saveToAdminLocalStorage warning:', e);
    }
  }

  // --------------------------------------------------------------------------
  // 6. ADMIN PORTAL (APPLICANT MANAGEMENT & ON-DEMAND PDF DOWNLOAD)
  // [보안 강화] SHA-256 단방향 암호화 해시 적용: 소스코드 및 GitHub에 평문 비밀번호가 절대 노출되지 않습니다.
  // --------------------------------------------------------------------------
  // 기본 관리자 비밀번호 해시 목록 (aione217! 및 aione217@ 지원, 복호화 불가)
  const DEFAULT_ADMIN_PW_HASHES = [
    '29a5db2f91e94992bc857c198836c04ffc0b375a0df0835d3c73d6a3419e8c50', // aione217!
    '3940070561060ddc20164314c9dfa5b43b7c8abce3118e839a6583e7ae13a13c'  // aione217@
  ];

  async function hashPassword(plainText) {
    if (!plainText) return '';
    try {
      const utf8 = new TextEncoder().encode(plainText);
      const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      return plainText;
    }
  }

  const getCustomAdminPasswordHash = () => {
    return localStorage.getItem('aione_admin_password_hash');
  };
  let adminApplicantsData = [];
  let currentSearchQuery = '';
  let currentGradeFilter = 'all';

  function initAdminPortal() {
    const openBtn = document.getElementById('admin-portal-open-btn');
    const sideOpenBtn = document.getElementById('side-admin-portal-open-btn');
    const modal = document.getElementById('admin-portal-modal');
    const closeBtn = document.getElementById('admin-close-btn');
    const authView = document.getElementById('admin-auth-view');
    const dashView = document.getElementById('admin-dashboard-view');
    const authForm = document.getElementById('admin-auth-form');
    const pwInput = document.getElementById('admin-password-input');
    const pwToggleBtn = document.getElementById('admin-pw-toggle-btn');
    const authError = document.getElementById('admin-auth-error');
    const refreshBtn = document.getElementById('admin-refresh-btn');
    const exportCsvBtn = document.getElementById('admin-export-csv-btn');
    const logoutBtn = document.getElementById('admin-logout-btn');
    const searchInput = document.getElementById('admin-search-input');
    const gradeFilter = document.getElementById('admin-grade-filter');
    const settingsToggleBtn = document.getElementById('admin-settings-toggle-btn');
    const settingsPanel = document.getElementById('admin-settings-panel');
    const gasUrlInput = document.getElementById('admin-gas-url-input');
    const gasUrlSaveBtn = document.getElementById('admin-gas-url-save-btn');
    const changePwInput = document.getElementById('admin-change-pw-input');
    const changePwSaveBtn = document.getElementById('admin-change-pw-save-btn');

    if (!modal) return;

    // Load saved GAS URL if available
    if (gasUrlInput) {
      const activeUrl = getGasUrl();
      gasUrlInput.value = (activeUrl && activeUrl !== "여기에_배포된_GAS_URL_입력") ? activeUrl : '';
    }

    if (gasUrlSaveBtn && gasUrlInput) {
      gasUrlSaveBtn.addEventListener('click', () => {
        const val = gasUrlInput.value.trim();
        if (val) {
          localStorage.setItem('aione_gas_url', val);
          window.showToast?.('✅ 구글 앱스 스크립트 연동 URL이 저장되었습니다.');
        } else {
          localStorage.removeItem('aione_gas_url');
          window.showToast?.('ℹ️ 연동 URL이 초기화되었습니다 (로컬 저장소 모드).');
        }
        loadAdminApplicants();
      });
    }

    // Change Password Button (Synchronized with Google Apps Script DB)
    if (changePwSaveBtn && changePwInput) {
      changePwSaveBtn.addEventListener('click', async () => {
        const newPw = changePwInput.value.trim();
        if (!newPw) {
          window.showToast?.('⚠️ 변경할 새 비밀번호를 입력해주세요.');
          return;
        }

        const gasUrl = getGasUrl();
        const currentPw = sessionStorage.getItem('aione_admin_pw') || '';

        changePwSaveBtn.disabled = true;
        changePwSaveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i><span>변경 중...</span>';

        let gasSynced = false;
        if (gasUrl && gasUrl !== "여기에_배포된_GAS_URL_입력") {
          try {
            const syncUrl = `${gasUrl}?action=change_password&old_pw=${encodeURIComponent(currentPw)}&new_pw=${encodeURIComponent(newPw)}`;
            const res = await fetch(syncUrl);
            if (res.ok) {
              const json = await res.json();
              if (json.status === 'success') {
                gasSynced = true;
              }
            }
          } catch (err) {
            console.warn('GAS change password sync error:', err);
          }
        }

        // 평문은 저장하지 않고 오직 SHA-256 단방향 암호화 해시만 브라우저에 저장
        const newHash = await hashPassword(newPw);
        localStorage.setItem('aione_admin_password_hash', newHash);
        localStorage.removeItem('aione_admin_password'); // 기존 평문 저장 데이터 완전 삭제
        sessionStorage.setItem('aione_admin_pw', newPw);
        changePwInput.value = '';
        changePwSaveBtn.disabled = false;
        changePwSaveBtn.innerHTML = '<span>비밀번호 변경</span>';

        if (gasSynced) {
          window.showToast?.(`🔑 웹사이트와 연동된 구글 DB 비밀번호가 [${newPw}]로 동시 변경되었습니다!`);
        } else if (gasUrl) {
          window.showToast?.(`🔑 로컬 비밀번호가 [${newPw}]로 변경되었습니다. (구글 시트 연동 상태 확인 권장)`);
        } else {
          window.showToast?.(`🔑 관리자 비밀번호가 [${newPw}]로 성공적으로 변경되었습니다.`);
        }

        // Open Password Changed Popup Modal
        const pwModal = document.getElementById('password-changed-modal');
        const pwModalVal = document.getElementById('pw-changed-modal-val');
        if (pwModalVal) pwModalVal.textContent = newPw;
        if (pwModal) pwModal.classList.add('active');
      });
    }

    if (settingsToggleBtn && settingsPanel) {
      settingsToggleBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
      });
    }

    const openAdmin = () => {
      const isAuthed = sessionStorage.getItem('aione_admin_authed') === 'true';
      if (isAuthed) {
        authView?.classList.add('hidden');
        dashView?.classList.remove('hidden');
        loadAdminApplicants();
      } else {
        authView?.classList.remove('hidden');
        dashView?.classList.add('hidden');
        if (pwInput) pwInput.value = '';
        authError?.classList.add('hidden');
      }
      modal.classList.add('active');
      if (!isAuthed && pwInput) {
        setTimeout(() => pwInput.focus(), 150);
      }
    };

    const closeAdmin = () => {
      modal.classList.remove('active');
    };

    if (openBtn) openBtn.addEventListener('click', openAdmin);
    if (sideOpenBtn) {
      sideOpenBtn.addEventListener('click', () => {
        const sideDrawer = document.getElementById('side-drawer');
        if (sideDrawer) {
          sideDrawer.classList.remove('is-open');
          sideDrawer.setAttribute('aria-hidden', 'true');
          document.body.style.overflow = '';
        }
        openAdmin();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeAdmin);

    // Global shortcut Ctrl+Shift+A (or Cmd+Shift+A)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (modal.classList.contains('active')) {
          closeAdmin();
        } else {
          openAdmin();
        }
      }
    });

    // Password view toggle
    if (pwToggleBtn && pwInput) {
      pwToggleBtn.addEventListener('click', () => {
        const isPw = pwInput.type === 'password';
        pwInput.type = isPw ? 'text' : 'password';
        pwToggleBtn.innerHTML = isPw ? '<i class="fa-regular fa-eye-slash text-sm"></i>' : '<i class="fa-regular fa-eye text-sm"></i>';
      });
    }

    // Password submit
    if (authForm && pwInput) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const enteredPw = pwInput.value.trim();
        const submitBtn = document.getElementById('admin-auth-submit-btn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>인증 확인 중...</span>';
        }

        let verified = false;
        const gasUrl = getGasUrl();
        const enteredHash = await hashPassword(enteredPw);
        const customHash = getCustomAdminPasswordHash();
        const legacyPlainPw = localStorage.getItem('aione_admin_password');

        // 1. 관리자가 직접 새로 설정한 커스텀 해시와 일치하는 경우
        if (customHash && enteredHash === customHash) {
          verified = true;
        }
        // 2. 브라우저에 기존 평문 저장 데이터가 남아있는 경우 (호환성 및 자동 해시 마이그레이션)
        else if (legacyPlainPw && enteredPw === legacyPlainPw) {
          verified = true;
          localStorage.setItem('aione_admin_password_hash', enteredHash);
          localStorage.removeItem('aione_admin_password');
        }
        // 3. 기본 비밀번호 해시 목록과 일치하는 경우 (aione217! 또는 aione217@ 모두 허용)
        else if (!customHash && DEFAULT_ADMIN_PW_HASHES.includes(enteredHash)) {
          verified = true;
        }
        // 4. Google Apps Script 백엔드 연동 확인
        else if (gasUrl && gasUrl !== "여기에_배포된_GAS_URL_입력") {
          try {
            const res = await fetch(`${gasUrl}?action=get_applicants&pw=${encodeURIComponent(enteredPw)}`);
            const json = await res.json();
            if (json.status === 'success') {
              verified = true;
            }
          } catch (_) {}
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>관리자 대시보드 입장</span><i class="fa-solid fa-arrow-right text-xs"></i>';
        }

        if (verified) {
          sessionStorage.setItem('aione_admin_authed', 'true');
          sessionStorage.setItem('aione_admin_pw', enteredPw);
          authError?.classList.add('hidden');
          authView?.classList.add('hidden');
          dashView?.classList.remove('hidden');
          window.showToast?.('🔐 관리자 인증이 완료되었습니다.');
          loadAdminApplicants();
        } else {
          authError?.classList.remove('hidden');
          pwInput.focus();
          pwInput.select();
        }
      });
    }

    // Logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('aione_admin_authed');
        sessionStorage.removeItem('aione_admin_pw');
        dashView?.classList.add('hidden');
        authView?.classList.remove('hidden');
        if (pwInput) pwInput.value = '';
        window.showToast?.('👋 관리자 세션이 로그아웃되었습니다.');
      });
    }

    // Refresh
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadAdminApplicants(true);
      });
    }

    // Search & Filter
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        renderApplicantTable();
      });
    }

    if (gradeFilter) {
      gradeFilter.addEventListener('change', (e) => {
        currentGradeFilter = e.target.value;
        renderApplicantTable();
      });
    }

    // CSV Export
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', exportApplicantsToCSV);
    }

    // Select All Checkbox
    const selectAllCheckbox = document.getElementById('admin-select-all');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const itemCheckboxes = document.querySelectorAll('.admin-select-item');
        itemCheckboxes.forEach(cb => {
          cb.checked = isChecked;
        });
        updateAdminSelectionState();
      });
    }

    // Batch Delete Selected Button
    const deleteSelectedBtn = document.getElementById('admin-delete-selected-btn');
    if (deleteSelectedBtn) {
      deleteSelectedBtn.addEventListener('click', async () => {
        const checkedBoxes = Array.from(document.querySelectorAll('.admin-select-item:checked'));
        if (checkedBoxes.length === 0) return;

        const count = checkedBoxes.length;
        const confirmMsg = `선택하신 ${count}명의 지원서를 일괄 삭제하시겠습니까?\n\n삭제된 지원서 내역은 복구할 수 없습니다.`;
        if (!confirm(confirmMsg)) return;

        deleteSelectedBtn.disabled = true;
        deleteSelectedBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i><span>삭제 중...</span>';

        const targets = checkedBoxes.map(cb => ({
          studentId: cb.getAttribute('data-student-id'),
          name: cb.getAttribute('data-name')
        }));
        const targetIds = new Set(targets.map(t => String(t.studentId)));

        // 1. Remove from local memory
        adminApplicantsData = adminApplicantsData.filter(item => !targetIds.has(String(item.student_id)));

        // 2. Remove from LocalStorage
        try {
          let localList = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || '[]');
          localList = localList.filter(item => !targetIds.has(String(item.student_id)));
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(localList));
        } catch (_) {}

        // 3. If GAS is connected, request deletion in Google Sheets
        const gasUrl = getGasUrl();
        const adminPw = sessionStorage.getItem('aione_admin_pw') || '';
        if (gasUrl && gasUrl !== "여기에_배포된_GAS_URL_입력") {
          try {
            await Promise.allSettled(
              targets.map(t => {
                const delUrl = `${gasUrl}?action=delete_applicant&student_id=${encodeURIComponent(t.studentId)}&name=${encodeURIComponent(t.name || '')}&pw=${encodeURIComponent(adminPw)}`;
                return fetch(delUrl);
              })
            );
          } catch (err) {
            console.warn('GAS batch delete error:', err);
          }
        }

        // 4. Update UI
        deleteSelectedBtn.disabled = false;
        deleteSelectedBtn.innerHTML = '<i class="fa-solid fa-trash-can text-xs text-rose-400"></i><span>선택 삭제 (<strong id="admin-selected-count">0</strong>)</span>';
        renderApplicantTable();
        window.showToast?.(`🗑️ 선택하신 ${count}명의 지원서가 성공적으로 삭제되었습니다.`);
      });
    }
  }

  function updateAdminSelectionState() {
    const selectAllCheckbox = document.getElementById('admin-select-all');
    const deleteSelectedBtn = document.getElementById('admin-delete-selected-btn');
    const selectedCountSpan = document.getElementById('admin-selected-count');

    const itemCheckboxes = document.querySelectorAll('.admin-select-item');
    const checkedBoxes = document.querySelectorAll('.admin-select-item:checked');
    const count = checkedBoxes.length;

    if (selectedCountSpan) {
      selectedCountSpan.textContent = count;
    }

    if (deleteSelectedBtn) {
      if (count > 0) {
        deleteSelectedBtn.classList.remove('hidden');
      } else {
        deleteSelectedBtn.classList.add('hidden');
      }
    }

    if (selectAllCheckbox) {
      if (itemCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      } else if (count === itemCheckboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else if (count > 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
      } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      }
    }
  }

  async function loadAdminApplicants(isManualRefresh = false) {
    const refreshBtn = document.getElementById('admin-refresh-btn');
    const badge = document.getElementById('admin-data-source-badge');

    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i><span class="hidden sm:inline">불러오는 중...</span>';
    }

    let localList = [];
    try {
      localList = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || '[]');
    } catch (_) {
      localList = [];
    }

    let gasList = [];
    let gasSuccess = false;
    const gasUrl = getGasUrl();
    const adminPw = sessionStorage.getItem('aione_admin_pw') || '';

    if (gasUrl && gasUrl !== "여기에_배포된_GAS_URL_입력") {
      try {
        const fetchUrl = `${gasUrl}?action=get_applicants&pw=${encodeURIComponent(adminPw)}`;
        const res = await fetch(fetchUrl);
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'success' && Array.isArray(json.applicants)) {
            gasList = json.applicants;
            gasSuccess = true;
          }
        }
      } catch (err) {
        console.warn('GAS fetch applicants error:', err);
      }
    }

    // Merge strategy: When Google Sheet is connected, it is the authoritative database.
    if (gasSuccess) {
      adminApplicantsData = gasList;
      try {
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(gasList));
      } catch (_) {}
      if (badge) {
        badge.innerHTML = '<i class="fa-brands fa-google text-[10px] text-emerald-400 mr-1"></i>구글 시트 연동됨';
        badge.className = 'px-2.5 py-1 rounded text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-300';
      }
      if (isManualRefresh) window.showToast?.(`🔄 구글 드라이브 및 시트와 동기화되었습니다 (${adminApplicantsData.length}건).`);
    } else {
      adminApplicantsData = localList;
      if (badge) {
        badge.innerHTML = '<i class="fa-solid fa-database text-[10px] text-sky-400 mr-1"></i>로컬 저장소';
        badge.className = 'px-2.5 py-1 rounded text-[11px] font-mono bg-white/5 border border-white/10 text-slate-400';
      }
      if (isManualRefresh) window.showToast?.(`🔄 로컬 저장소에서 ${adminApplicantsData.length}건의 지원 내역을 불러왔습니다.`);
    }

    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<i class="fa-solid fa-rotate-right text-xs"></i><span class="hidden sm:inline">새로고침</span>';
    }

    renderApplicantTable();
  }

  function renderApplicantTable() {
    const tbody = document.getElementById('admin-applicant-table-body');
    const emptyState = document.getElementById('admin-empty-state');
    const statTotal = document.getElementById('admin-stat-total');
    const statUg = document.getElementById('admin-stat-ug');
    const statGrad = document.getElementById('admin-stat-grad');

    if (!tbody) return;

    // Calculate overall stats
    let totalUg = 0;
    let totalGrad = 0;
    adminApplicantsData.forEach(item => {
      const gradeStr = (item.grade || '').toLowerCase();
      if (gradeStr.includes('석사') || gradeStr.includes('대학원')) {
        totalGrad++;
      } else {
        totalUg++;
      }
    });

    if (statTotal) statTotal.textContent = adminApplicantsData.length;
    if (statUg) statUg.textContent = totalUg;
    if (statGrad) statGrad.textContent = totalGrad;

    // Filter applicants
    const filtered = adminApplicantsData.filter(app => {
      // 1. Search Query filter
      if (currentSearchQuery) {
        const matchText = [
          app.name,
          app.student_id,
          app.grade,
          app.phone,
          app.tech_stack,
          app.keyword_intro,
          app.motivation
        ].join(' ').toLowerCase();

        if (!matchText.includes(currentSearchQuery)) return false;
      }

      // 2. Grade Filter
      if (currentGradeFilter !== 'all') {
        const gradeStr = (app.grade || '').toLowerCase();
        if (currentGradeFilter === 'grad') {
          return gradeStr.includes('석사') || gradeStr.includes('대학원');
        } else if (currentGradeFilter === '6기') {
          return gradeStr.includes('6기') || gradeStr.includes('2학년') || gradeStr.includes('예비');
        } else if (currentGradeFilter === 'undergrad') {
          return !gradeStr.includes('석사') && !gradeStr.includes('대학원');
        }
      }

      return true;
    });

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      emptyState?.classList.remove('hidden');
      updateAdminSelectionState();
      return;
    }

    emptyState?.classList.add('hidden');

    filtered.forEach((app, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-white/[0.03] transition-colors';

      const dateStr = app.submitted_at || app.submit_date || '-';
      const gradeStr = app.grade || '학부연구생';
      const isGrad = gradeStr.includes('석사');
      const badgeClass = isGrad
        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
        : 'bg-sky-500/15 text-sky-300 border-sky-500/30';

      tr.innerHTML = `
        <td class="py-3 px-2 text-center">
          <input type="checkbox" class="admin-select-item form-checkbox rounded text-sky-500 cursor-pointer w-3.5 h-3.5 accent-sky-500" data-student-id="${escapeHtml(app.student_id)}" data-name="${escapeHtml(app.name)}">
        </td>
        <td class="py-3 px-2 text-center text-slate-500 font-mono">${idx + 1}</td>
        <td class="py-3 px-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">${escapeHtml(dateStr)}</td>
        <td class="py-3 px-3 whitespace-nowrap font-bold text-white">${escapeHtml(app.name || '-')}</td>
        <td class="py-3 px-3 whitespace-nowrap font-mono text-sky-400">${escapeHtml(app.student_id || '-')}</td>
        <td class="py-3 px-3 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeClass}">
            ${escapeHtml(gradeStr)}
          </span>
        </td>
        <td class="py-3 px-3 whitespace-nowrap font-mono">
          <a href="tel:${escapeHtml(app.phone || '')}" class="text-slate-300 hover:text-sky-400 transition-colors">
            ${escapeHtml(app.phone || '-')}
          </a>
        </td>
        <td class="py-3 px-4 max-w-[200px]">
          <span class="truncate block text-slate-300" title="${escapeHtml(app.keyword_intro || '')}">
            ${escapeHtml(app.keyword_intro || '-')}
          </span>
        </td>
        <td class="py-3 px-3 whitespace-nowrap text-center">
          <div class="inline-flex items-center gap-1.5">
            <button type="button" class="admin-act-pdf btn-glow-primary !py-1 !px-2.5 text-[11px] flex items-center gap-1 shadow-sm" title="공식 2-Page 지원서 양식 PDF 다운로드">
              <i class="fa-solid fa-file-arrow-down text-[10px]"></i>
              <span>PDF</span>
            </button>
            <button type="button" class="admin-act-view btn-glow-secondary !py-1 !px-2 text-[11px] flex items-center gap-1" title="지원서 미리보기 창 열기">
              <i class="fa-solid fa-eye text-[10px] text-sky-400"></i>
              <span>보기</span>
            </button>
            <button type="button" class="admin-act-copy btn-glow-secondary !py-1 !px-2 text-[11px] text-slate-400 hover:text-white" title="지원자 핵심 정보 클립보드 복사">
              <i class="fa-regular fa-copy text-[10px]"></i>
            </button>
            <button type="button" class="admin-act-delete btn-glow-secondary !py-1 !px-2 text-[11px] text-slate-400 hover:!text-rose-400 hover:!border-rose-500/40" title="지원서 삭제">
              <i class="fa-solid fa-trash-can text-[10px]"></i>
            </button>
          </div>
        </td>
      `;

      // Checkbox listener
      const itemCheckbox = tr.querySelector('.admin-select-item');
      if (itemCheckbox) {
        itemCheckbox.addEventListener('change', () => {
          updateAdminSelectionState();
        });
      }

      // Bind Action Buttons
      const pdfBtn = tr.querySelector('.admin-act-pdf');
      if (pdfBtn) {
        pdfBtn.addEventListener('click', async () => {
          pdfBtn.disabled = true;
          pdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[10px]"></i>';
          try {
            window.showToast?.(`📄 [${app.name}] 지원서 공식 양식 PDF를 생성 중입니다...`);
            await generateApplicationPDF(app);
            window.showToast?.(`✅ [${app.name}] 지원서 PDF 저장이 완료되었습니다.`);
          } catch (err) {
            console.error('PDF download error:', err);
            window.showToast?.(`⚠️ PDF 생성 중 오류가 발생했습니다: ${err.message}`);
          } finally {
            pdfBtn.disabled = false;
            pdfBtn.innerHTML = '<i class="fa-solid fa-file-arrow-down text-[10px]"></i><span>PDF</span>';
          }
        });
      }

      const viewBtn = tr.querySelector('.admin-act-view');
      if (viewBtn) {
        viewBtn.addEventListener('click', () => {
          openApplicantViewerModal(app);
        });
      }

      const copyBtn = tr.querySelector('.admin-act-copy');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          copyApplicantSummary(app);
        });
      }

      const deleteBtn = tr.querySelector('.admin-act-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          const confirmMsg = `정말로 [${app.name} (${app.student_id})] 지원자의 지원서를 삭제하시겠습니까?\n\n삭제된 지원서 내역은 복구할 수 없습니다.`;
          if (!confirm(confirmMsg)) return;

          deleteBtn.disabled = true;
          deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[10px]"></i>';

          // 1. Remove from local memory
          adminApplicantsData = adminApplicantsData.filter(item => {
            const isMatch = String(item.student_id) === String(app.student_id) &&
                            (item.submitted_at === app.submitted_at || !item.submitted_at || !app.submitted_at);
            return !isMatch;
          });

          // 2. Remove from LocalStorage
          try {
            let localList = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || '[]');
            localList = localList.filter(item => String(item.student_id) !== String(app.student_id));
            localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(localList));
          } catch (_) {}

          // 3. If GAS is connected, request deletion in Google Sheets
          const gasUrl = getGasUrl();
          const adminPw = sessionStorage.getItem('aione_admin_pw') || '';
          if (gasUrl && gasUrl !== "여기에_배포된_GAS_URL_입력") {
            try {
              const delUrl = `${gasUrl}?action=delete_applicant&student_id=${encodeURIComponent(app.student_id)}&name=${encodeURIComponent(app.name)}&pw=${encodeURIComponent(adminPw)}`;
              await fetch(delUrl);
            } catch (err) {
              console.warn('GAS delete error:', err);
            }
          }

          // 4. Update UI
          renderApplicantTable();
          window.showToast?.(`🗑️ [${app.name} (${app.student_id})] 지원서가 성공적으로 삭제되었습니다.`);
        });
      }

      tbody.appendChild(tr);
    });

    updateAdminSelectionState();
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

  function copyApplicantSummary(app) {
    const summary = [
      `[AIONE LAB 2026 지원자 요약]`,
      `- 성명: ${app.name || '-'} (${app.student_id || '-'} / ${app.grade || '-'})`,
      `- 연락처: ${app.phone || '-'}`,
      `- 병역구분: ${app.military || '-'}`,
      `- 기술스택: ${app.tech_stack || '없음'}`,
      `- 면접가능시간: ${app.interview_available_times || '-'}`,
      `- 포트폴리오: ${app.portfolio_links || '없음'}`,
      `- 나를 표현하는 단어: ${app.keyword_intro || '-'}`,
      `- 지원동기: ${app.motivation || '-'}`
    ].join('\n');

    navigator.clipboard.writeText(summary).then(() => {
      window.showToast?.(`📋 [${app.name}] 지원자 요약 정보가 복사되었습니다.`);
    }).catch(() => {
      window.showToast?.(`📋 복사 실패 (브라우저 권한을 확인해주세요).`);
    });
  }

  function exportApplicantsToCSV() {
    if (!adminApplicantsData || adminApplicantsData.length === 0) {
      window.showToast?.('⚠️ 내보낼 지원자 내역이 없습니다.');
      return;
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
      '포트폴리오링크'
    ];

    const rows = adminApplicantsData.map(app => [
      app.submitted_at || app.submit_date || '',
      app.name || '',
      app.student_id || '',
      app.grade || '',
      app.phone || '',
      app.military || '',
      app.keyword_intro || '',
      app.motivation || '',
      app.problem_solving || '',
      app.study_plan || '',
      app.expectation || '',
      app.career_plan || '',
      app.tech_stack || '',
      app.desired_activities || '',
      app.interview_available_times || '',
      app.portfolio_links || ''
    ]);

    const escapeCsv = (val) => {
      const str = String(val || '').replace(/"/g, '""');
      return `"${str}"`;
    };

    let csvContent = '\uFEFF'; // UTF-8 BOM for Microsoft Excel compatibility
    csvContent += headers.map(escapeCsv).join(',') + '\r\n';
    rows.forEach(row => {
      csvContent += row.map(escapeCsv).join(',') + '\r\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `AIONE_LAB_2026_지원자명단_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 2000);

    window.showToast?.(`📥 전체 지원자 명단(${adminApplicantsData.length}건) CSV 엑셀 파일이 다운로드되었습니다.`);
  }

  // Auto-restore draft & check online applicant viewer on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    restoreDraft();
    checkAndOpenViewer();
    initAdminPortal();
  });
})();
