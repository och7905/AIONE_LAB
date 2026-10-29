/**
 * AIONE LAB - Interactive Neural Network Particle Canvas
 * 대전대학교 컴퓨터공학 인공지능 연구실
 */

(function () {
  const canvas = document.getElementById('neural-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height, dpr;
  let particles = [];
  let mouse = { x: -1000, y: -1000, radius: 140, isHovering: false };
  let animationFrameId = null;

  // Particle configuration
  const config = {
    particleCount: window.innerWidth < 768 ? 45 : 95,
    maxDistance: 130,
    speed: 0.45,
    baseRadius: 2.2,
  };

  // Color profiles for Dark / Light modes
  function getThemeColors() {
    const isLight = document.documentElement.classList.contains('light');
    if (isLight) {
      return {
        particle: 'rgba(2, 132, 199, ',       // Sky blue
        accentParticle: 'rgba(99, 102, 241, ', // Indigo
        line: 'rgba(2, 132, 199, ',
      };
    } else {
      return {
        particle: 'rgba(56, 189, 248, ',       // Neon cyan
        accentParticle: 'rgba(168, 85, 247, ', // Purple
        line: 'rgba(56, 189, 248, ',
      };
    }
  }

  let themeColors = getThemeColors();

  // Resize canvas to match window
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.scale(dpr, dpr);

    config.particleCount = width < 768 ? 45 : 95;
    initParticles();
  }

  // Particle Class
  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * config.speed;
      this.vy = (Math.random() - 0.5) * config.speed;
      this.radius = Math.random() * 1.5 + config.baseRadius;
      this.isAccent = Math.random() > 0.75;
      this.alpha = Math.random() * 0.5 + 0.35;
      this.pulseSpeed = 0.02 + Math.random() * 0.02;
      this.pulseFactor = 0;
    }

    update() {
      // Movement
      this.x += this.vx;
      this.y += this.vy;

      // Wall bounce
      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;

      // Mouse interaction (gentle repulsion)
      if (mouse.isHovering) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          const angle = Math.atan2(dy, dx);
          this.x -= Math.cos(angle) * force * 2.2;
          this.y -= Math.sin(angle) * force * 2.2;
        }
      }

      // Breathing glow pulse
      this.pulseFactor += this.pulseSpeed;
    }

    draw() {
      const pulse = Math.sin(this.pulseFactor) * 0.2;
      const currentAlpha = Math.max(0.1, Math.min(0.9, this.alpha + pulse));
      const colorBase = this.isAccent ? themeColors.accentParticle : themeColors.particle;

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = colorBase + currentAlpha + ')';
      ctx.fill();

      // Subtle outer glow for accent particles
      if (this.isAccent) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = colorBase + (currentAlpha * 0.18) + ')';
        ctx.fill();
      }
    }
  }

  function initParticles() {
    particles = [];
    for (let i = 0; i < config.particleCount; i++) {
      particles.push(new Particle());
    }
  }

  function connectParticles() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.hypot(dx, dy);

        if (dist < config.maxDistance) {
          const opacity = (1 - dist / config.maxDistance) * 0.22;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = themeColors.line + opacity + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Connect to mouse pointer
      if (mouse.isHovering) {
        const dx = particles[i].x - mouse.x;
        const dy = particles[i].y - mouse.y;
        const dist = Math.hypot(dx, dy);

        if (dist < mouse.radius) {
          const opacity = (1 - dist / mouse.radius) * 0.45;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = themeColors.line + opacity + ')';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }

    connectParticles();

    animationFrameId = requestAnimationFrame(animate);
  }

  // Event Listeners
  window.addEventListener('resize', () => {
    resize();
  });

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.isHovering = true;
  });

  window.addEventListener('mouseleave', () => {
    mouse.isHovering = false;
  });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.isHovering = true;
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    mouse.isHovering = false;
  });

  // Observe theme change on <html>
  const observer = new MutationObserver(() => {
    themeColors = getThemeColors();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // Handle page visibility
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrameId);
    } else {
      animate();
    }
  });

  // Init
  resize();
  animate();
})();
