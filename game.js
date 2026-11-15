(() => {
  'use strict';
  if (typeof Phaser === 'undefined') { window.showGameError(); return; }

  // Give each new prototype its own key so projects on localhost do not share parameters.
  const storageKey = 'phaser-template:parameters:v1';
  const dialog = document.getElementById('settings-dialog');
  const openSettings = document.getElementById('open-settings');
  const note = document.getElementById('settings-note');
  const counter = document.getElementById('counter');
  const controls = [
    { key: 'count', id: 'object-count', unit: '' },
    { key: 'radius', id: 'object-radius', unit: '' },
    { key: 'duration', id: 'pulse-duration', unit: ' мс' }
  ].map(control => ({ ...control, input: document.getElementById(control.id), output: document.getElementById(`${control.id}-value`) }));

  function normalize(raw = {}) {
    return Object.fromEntries(controls.map(({ key, input }) => {
      const min = Number(input.min), max = Number(input.max), step = Number(input.step);
      const value = typeof raw?.[key] === 'number' && Number.isFinite(raw[key]) ? raw[key] : Number(input.defaultValue);
      return [key, Math.max(min, Math.min(max, min + Math.round((value - min) / step) * step))];
    }));
  }
  let parameters;
  try {
    parameters = normalize(JSON.parse(localStorage.getItem(storageKey)));
  } catch {
    parameters = normalize();
    note.textContent = 'Не удалось прочитать сохранённые параметры. Используются исходные.';
  }
  function saveParameters() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(parameters));
      note.textContent = 'Параметры сохранены в браузере';
    } catch {
      note.textContent = 'Браузер запретил сохранение. Параметры действуют до закрытия страницы.';
    }
  }
  function syncControls() {
    controls.forEach(({ key, input, output, unit }) => {
      input.value = parameters[key];
      output.textContent = `${parameters[key]}${unit}`;
    });
  }
  syncControls();
  let scene;
  let clicks = 0;

  class DemoScene extends Phaser.Scene {
    constructor() { super('DemoScene'); }

    create() {
      scene = this;
      this.circles = [];
      this.rebuildObjects();
      this.scale.on('resize', this.layoutObjects, this);
      const observer = new ResizeObserver(() => this.layoutObjects());
      observer.observe(document.querySelector('.hud'));
      this.events.once('shutdown', () => {
        observer.disconnect();
        this.scale.off('resize', this.layoutObjects, this);
        scene = undefined;
      });
      if (dialog.open) this.scene.pause();
    }

    rebuildObjects() {
      this.tweens.killAll();
      this.circles.forEach(circle => circle.destroy());
      const colors = [0xf17d72, 0xf1c75b, 0x70bca4, 0x829fe8];
      this.circles = Array.from({ length: parameters.count }, (_, index) => {
        const circle = this.add.circle(0, 0, 1, colors[index % colors.length])
          .setInteractive({ hitArea: new Phaser.Geom.Circle(1, 1, 1), hitAreaCallback: Phaser.Geom.Circle.Contains, useHandCursor: true });
        circle.on('pointerdown', () => {
          if (dialog.open) return;
          clicks += 1;
          counter.textContent = clicks;
          this.tweens.killTweensOf(circle);
          circle.setScale(1);
          this.tweens.add({ targets: circle, scale: 1.2, duration: parameters.duration, yoyo: true });
        });
        return circle;
      });
      this.layoutObjects();
    }

    layoutObjects() {
      const { width, height } = this.scale;
      const hudBottom = document.querySelector('.hud').getBoundingClientRect().bottom;
      const arenaTop = document.querySelector('.arena').getBoundingClientRect().top;
      const margin = 24;
      const top = Math.min(height - margin, hudBottom - arenaTop + margin);
      const playWidth = Math.max(1, width - margin * 2);
      const playHeight = Math.max(1, height - top - margin);
      const targetColumns = Math.min(this.circles.length, Math.max(1, Math.ceil(Math.sqrt(this.circles.length * playWidth / playHeight))));
      const rows = Math.ceil(this.circles.length / targetColumns);
      const columns = Math.ceil(this.circles.length / rows);
      const cellWidth = playWidth / columns, cellHeight = playHeight / rows;
      const radius = Math.min(parameters.radius, cellWidth * .32, cellHeight * .32);
      this.circles.forEach((circle, index) => {
        circle.setPosition(margin + (index % columns + .5) * cellWidth, top + (Math.floor(index / columns) + .5) * cellHeight);
        circle.setRadius(radius);
        // Geometry changed after setInteractive: keep the pointer target in sync.
        circle.input.hitArea.setTo(radius, radius, radius);
      });
    }
  }

  window.prototypeGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#f1f5fa',
    loader: { imageLoadType: 'HTMLImageElement' },
    scale: { mode: Phaser.Scale.RESIZE },
    scene: DemoScene
  });

  openSettings.addEventListener('click', () => {
    dialog.showModal();
    scene?.scene.pause();
  });
  for (const id of ['close-settings', 'settings-done']) {
    document.getElementById(id).addEventListener('click', () => dialog.close());
  }
  dialog.addEventListener('close', () => {
    scene?.scene.resume();
    openSettings.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = dialog.querySelectorAll('button:not(:disabled), input:not(:disabled)');
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  controls.forEach(({ key, input }) => input.addEventListener('input', () => {
    parameters = normalize({ ...parameters, [key]: Number(input.value) });
    syncControls();
    saveParameters();
    scene?.rebuildObjects();
  }));
  document.getElementById('reset-parameters').addEventListener('click', () => {
    parameters = normalize();
    syncControls();
    saveParameters();
    scene?.rebuildObjects();
  });
  document.getElementById('reset').addEventListener('click', () => {
    clicks = 0;
    counter.textContent = '0';
    scene?.rebuildObjects();
  });
})();
