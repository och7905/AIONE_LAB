/**
 * AIONE LAB - Application Form Management & Formspree Integration
 * 대전대학교 컴퓨터공학 인공지능 연구실 (AIONE LAB)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'aione_application_draft';
  const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mzeevple';
  const CONTACT_EMAIL = 'och7905@naver.com';

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

      // Initial count check
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
      // Allow control and navigation keys
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
      // Block all non-digit keys (including English and Korean IME keys)
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
      // Allow control and navigation keys
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
      // Block all non-digit keys
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
  // Multi-File Upload Dropzone Handler
  // --------------------------------------------------------------------------
  const fileInput = document.getElementById('file_attachment');
  const fileDropZone = document.getElementById('file-drop-zone');
  const selectedFilesContainer = document.getElementById('selected-files-container');
  const selectedFilesList = document.getElementById('selected-files-list');
  const filesSummaryCount = document.getElementById('files-summary-count');
  const filesTotalStats = document.getElementById('files-total-stats');
  const clearAllFilesBtn = document.getElementById('clear-all-files-btn');
  
  let attachedFiles = []; // Array of { file, name, size, formattedSize, id }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    switch (ext) {
      case 'pdf': return '<i class="fa-solid fa-file-pdf text-rose-400"></i>';
      case 'zip':
      case '7z':
      case 'tar':
      case 'gz': return '<i class="fa-solid fa-file-zipper text-amber-400"></i>';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif': return '<i class="fa-solid fa-file-image text-emerald-400"></i>';
      case 'doc':
      case 'docx':
      case 'hwp': return '<i class="fa-solid fa-file-word text-blue-400"></i>';
      default: return '<i class="fa-solid fa-file-lines text-sky-400"></i>';
    }
  }

  function addFiles(newFiles) {
    if (!newFiles || newFiles.length === 0) return;
    let addedCount = 0;
    Array.from(newFiles).forEach(file => {
      const exists = attachedFiles.some(f => f.name === file.name && f.size === file.size);
      if (!exists) {
        attachedFiles.push({
          file: file,
          name: file.name,
          size: file.size,
          formattedSize: formatFileSize(file.size),
          id: Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      window.showToast?.(`📎 ${addedCount}개의 파일이 추가되었습니다. (총 ${attachedFiles.length}개)`);
    } else {
      window.showToast?.('⚠️ 이미 목록에 추가된 파일입니다.');
    }
    renderFileList();
    if (fileInput) fileInput.value = '';
  }

  function removeFile(fileId) {
    attachedFiles = attachedFiles.filter(f => f.id !== fileId);
    renderFileList();
    window.showToast?.('🗑️ 파일이 삭제되었습니다.');
  }

  function renderFileList() {
    if (!selectedFilesContainer || !selectedFilesList) return;

    if (attachedFiles.length === 0) {
      selectedFilesContainer.classList.add('hidden');
      if (filesSummaryCount) filesSummaryCount.classList.add('hidden');
      if (fileDropZone) fileDropZone.classList.remove('border-sky-400');
      return;
    }

    selectedFilesContainer.classList.remove('hidden');
    if (fileDropZone) fileDropZone.classList.add('border-sky-400');

    // Total size calculation
    const totalBytes = attachedFiles.reduce((acc, f) => acc + f.size, 0);
    const totalFormatted = formatFileSize(totalBytes);

    if (filesSummaryCount) {
      filesSummaryCount.textContent = `${attachedFiles.length}개 첨부됨 (${totalFormatted})`;
      filesSummaryCount.classList.remove('hidden');
    }

    if (filesTotalStats) {
      filesTotalStats.textContent = `첨부 파일 목록 (${attachedFiles.length}개 · 총 ${totalFormatted})`;
    }

    selectedFilesList.innerHTML = '';
    attachedFiles.forEach(f => {
      const item = document.createElement('div');
      item.className = 'p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-between text-xs text-slate-200 transition-colors hover:bg-sky-500/15';
      item.innerHTML = `
        <div class="flex items-center gap-2.5 truncate mr-2">
          ${getFileIcon(f.name)}
          <span class="truncate font-mono text-white text-xs font-semibold">${f.name}</span>
          <span class="text-[11px] text-slate-400 font-mono whitespace-nowrap">(${f.formattedSize})</span>
        </div>
        <button type="button" class="text-rose-400 hover:text-rose-300 font-bold px-2 py-1 rounded hover:bg-rose-500/15 transition-colors cursor-pointer text-xs flex items-center gap-1" data-remove-id="${f.id}" title="파일 삭제">
          <i class="fa-solid fa-xmark"></i>
          <span>삭제</span>
        </button>
      `;

      item.querySelector('button').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeFile(f.id);
      });

      selectedFilesList.appendChild(item);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        addFiles(fileInput.files);
      }
    });
  }

  if (clearAllFilesBtn) {
    clearAllFilesBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      attachedFiles = [];
      renderFileList();
      window.showToast?.('🗑️ 모든 첨부 파일이 삭제되었습니다.');
    });
  }

  // Drag-and-drop feedback on dropzone
  if (fileDropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      fileDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileDropZone.classList.add('border-sky-400', 'bg-sky-500/10');
      });
    });

    ['dragleave', 'dragend'].forEach(eventName => {
      fileDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileDropZone.classList.remove('border-sky-400', 'bg-sky-500/10');
      });
    });

    fileDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileDropZone.classList.remove('border-sky-400', 'bg-sky-500/10');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    });
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
        // Trigger character counters update
        charLimitFields.forEach(({ id, limit, counterId }) => {
          const textarea = document.getElementById(id);
          const counter = document.getElementById(counterId);
          if (textarea && counter) {
            counter.textContent = `${textarea.value.length} / ${limit}자`;
          }
        });

        // Ensure formatting for student ID and phone
        if (studentIdInput && studentIdInput.value) {
          studentIdInput.value = studentIdInput.value.replace(/[^0-9]/g, '').slice(0, 10);
        }
        if (phoneInput && phoneInput.value) {
          const raw = phoneInput.value.replace(/[^0-9]/g, '').slice(0, 11);
          if (raw.length > 7) {
            phoneInput.value = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
          } else if (raw.length > 3) {
            phoneInput.value = `${raw.slice(0, 3)}-${raw.slice(3)}`;
          } else {
            phoneInput.value = raw;
          }
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
        attachedFiles = [];
        renderFileList();
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
      if (key !== 'file_attachment') {
        data[key] = value.trim();
      }
    }
    if (attachedFiles.length > 0) {
      data.attached_files = attachedFiles.map(f => `${f.name} (${f.formattedSize})`);
      data.attached_files_count = attachedFiles.length;
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
        portfolio_links: data.portfolio_links,
        attached_files: attachedFiles.length > 0 ? attachedFiles.map(f => ({ name: f.name, size: f.formattedSize })) : []
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
  // Form Submission & Formspree AJAX
  // --------------------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Basic Validation
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = collectFormData();

    // Format subject as required: [AIONE LAB 신규 지원서] {이름} ({학번} / {학년})
    const emailSubject = `[AIONE LAB 신규 지원서] ${data.name} (${data.student_id} / ${data.grade})`;

    // Prepare payload for Formspree
    const payload = {
      _subject: emailSubject,
      "성명": data.name,
      "학번": data.student_id,
      "지원구분_학년": data.grade,
      "연락처": data.phone,
      "병역구분": data.military,
      "나를표현하는단어_이유": data.keyword_intro,
      "지원동기(500자)": data.motivation,
      "문제해결경험(500자)": data.problem_solving,
      "학업계획(200자)": data.study_plan,
      "얻고자하는것(200자)": data.expectation,
      "졸업후진로계획(200자)": data.career_plan,
      "기술스택_경험": data.tech_stack || "없음",
      "연구실희망활동": data.desired_activities || "없음",
      "면접가능시간": data.interview_available_times,
      "포트폴리오링크": data.portfolio_links || "없음",
      "첨부파일_목록": attachedFiles.length > 0 ? attachedFiles.map((f, i) => `${i + 1}. ${f.name} (${f.formattedSize})`).join('\n') : "첨부파일 없음",
      "첨부파일_총개수": `${attachedFiles.length}개`,
      "제출일시": new Date().toLocaleString('ko-KR')
    };

    // UI Loading state
    setLoadingState(true);

    try {
      const response = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Success
        localStorage.removeItem(STORAGE_KEY);
        downloadBackupJSON(data);
        showSuccessModal(data);
        form.reset();
        attachedFiles = [];
        renderFileList();
        charLimitFields.forEach(({ limit, counterId }) => {
          const counter = document.getElementById(counterId);
          if (counter) counter.textContent = `0 / ${limit}자`;
        });
        syncAllPills();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Formspree 전송 오류');
      }
    } catch (error) {
      console.error('Submission failed:', error);
      handleSubmissionError(data, error);
    } finally {
      setLoadingState(false);
    }
  });

  function setLoadingState(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true;
      submitBtnText.textContent = '지원서 전송 중...';
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
    if (modalApplicantName) {
      modalApplicantName.textContent = `${data.name} (${data.student_id})`;
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
      const filesSummary = attachedFiles.length > 0 ? attachedFiles.map((f, i) => `${i + 1}. ${f.name} (${f.formattedSize})`).join(', ') : "첨부파일 없음";
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
        `[첨부 파일]:\n${filesSummary}\n(파일은 본 메일에 수동 첨부 부탁드립니다)`
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
