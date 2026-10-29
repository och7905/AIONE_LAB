/**
 * AIONE LAB - Main Controller
 * Handles Theme Toggle, Navigation, Scroll Control, Toast Notifications, and Modals
 */

(function () {
  // --------------------------------------------------------------------------
  // 0. Page Start Position: Force Top on Initial Load (Zero Scroll Offset)
  // --------------------------------------------------------------------------
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  function forceScrollToTop() {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }

  // Execute immediately to prevent any previous scroll restoration
  forceScrollToTop();

  // If a hash like #apply exists on direct entry/refresh, clear it to start at the top
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  window.addEventListener('DOMContentLoaded', () => {
    forceScrollToTop();
  });

  window.addEventListener('load', () => {
    forceScrollToTop();
    setTimeout(forceScrollToTop, 20);
    setTimeout(forceScrollToTop, 100);
  });

  // --------------------------------------------------------------------------
  // 1. Theme Toggle (Dark / Light)
  // --------------------------------------------------------------------------
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeToggleMobileBtn = document.getElementById('theme-toggle-mobile');
  const themeIconDark = document.getElementById('theme-icon-dark');
  const themeIconLight = document.getElementById('theme-icon-light');

  function initTheme() {
    const savedTheme = localStorage.getItem('aione_theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

    if (savedTheme === 'light' || (!savedTheme && prefersLight)) {
      document.documentElement.classList.add('light');
      updateThemeIcons(true);
    } else {
      document.documentElement.classList.remove('light');
      updateThemeIcons(false);
    }
  }

  function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('aione_theme', isLight ? 'light' : 'dark');
    updateThemeIcons(isLight);
    showToast(isLight ? '☀️ 라이트 모드로 전환되었습니다.' : '🌙 다크 모드로 전환되었습니다.');
  }

  function updateThemeIcons(isLight) {
    if (themeIconDark && themeIconLight) {
      if (isLight) {
        themeIconDark.classList.remove('hidden');
        themeIconLight.classList.add('hidden');
      } else {
        themeIconDark.classList.add('hidden');
        themeIconLight.classList.remove('hidden');
      }
    }
  }

  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
  if (themeToggleMobileBtn) themeToggleMobileBtn.addEventListener('click', toggleTheme);

  initTheme();

  // --------------------------------------------------------------------------
  // 2. Off-Canvas Sidebar Navigation Drawer (사이드 토글 메뉴)
  // --------------------------------------------------------------------------
  const sideDrawer = document.getElementById('side-drawer');
  const sideDrawerOpenBtn = document.getElementById('side-drawer-open-btn');
  const sideDrawerCloseBtn = document.getElementById('side-drawer-close-btn');

  function openSideDrawer() {
    if (sideDrawer) {
      sideDrawer.classList.add('is-open');
      sideDrawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeSideDrawer() {
    if (sideDrawer) {
      sideDrawer.classList.remove('is-open');
      sideDrawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  if (sideDrawerOpenBtn) {
    sideDrawerOpenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSideDrawer();
    });
  }

  if (sideDrawerCloseBtn) {
    sideDrawerCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSideDrawer();
    });
  }

  // Backdrop click to close drawer
  if (sideDrawer) {
    sideDrawer.addEventListener('click', (e) => {
      if (e.target === sideDrawer) {
        closeSideDrawer();
      }
    });
  }

  // Close on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sideDrawer?.classList.contains('is-open')) {
      closeSideDrawer();
    }
  });

  // Smooth scroll for all anchor navigation links & auto close drawer
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      closeSideDrawer();

      if (targetId === '#') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.pushState(null, '', targetId);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Floating Quick Navigation (Scroll-to-Top Button)
  // --------------------------------------------------------------------------
  const scrollTopBtn = document.getElementById('scroll-to-top');
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 280) {
        scrollTopBtn.classList.remove('opacity-0', 'pointer-events-none');
        scrollTopBtn.classList.add('opacity-100', 'pointer-events-auto');
      } else {
        scrollTopBtn.classList.add('opacity-0', 'pointer-events-none');
        scrollTopBtn.classList.remove('opacity-100', 'pointer-events-auto');
      }
    });

    scrollTopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // --------------------------------------------------------------------------
  // 4. Toast Notifications
  // --------------------------------------------------------------------------
  const toastContainer = document.getElementById('toast-container');

  window.showToast = function (message, duration = 3500) {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <span>${message}</span>
      </div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, duration);
  };

  // --------------------------------------------------------------------------
  // 5. Modal Handlers
  // --------------------------------------------------------------------------
  const modals = document.querySelectorAll('.modal-backdrop');

  modals.forEach(modal => {
    // Backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });

    // Close button
    const closeBtns = modal.querySelectorAll('.modal-close-btn');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal(modal);
      });
    });
  });

  function closeModal(modal) {
    modal.classList.remove('active');
  }

  // ESC key to close active modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modals.forEach(modal => {
        if (modal.classList.contains('active')) {
          closeModal(modal);
        }
      });
    }
  });

  // --------------------------------------------------------------------------
  // 6. Copy-to-Clipboard Helpers
  // --------------------------------------------------------------------------
  document.querySelectorAll('[data-copy]').forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      const text = button.getAttribute('data-copy');
      const label = button.getAttribute('data-copy-label') || '내용';

      try {
        await navigator.clipboard.writeText(text);
        showToast(`📋 ${label}이(가) 클립보드에 복사되었습니다: ${text}`);
      } catch (err) {
        // Fallback for older browsers
        const temp = document.createElement('textarea');
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        showToast(`📋 ${label}이(가) 복사되었습니다: ${text}`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 7. Header Glow on Scroll
  // --------------------------------------------------------------------------
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      header?.classList.add('shadow-lg', 'shadow-sky-500/5');
    } else {
      header?.classList.remove('shadow-lg', 'shadow-sky-500/5');
    }
  });
})();
