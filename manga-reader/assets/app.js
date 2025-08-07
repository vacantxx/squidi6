const state = {
  library: null,
  fitWidth: parseInt(localStorage.getItem('fitWidth'), 10) || 980,
};

function setFitWidth(px) {
  state.fitWidth = px;
  localStorage.setItem('fitWidth', String(px));
  document.documentElement.style.setProperty('--fit-width', `${px}px`);
}

setFitWidth(state.fitWidth);

async function loadLibrary() {
  if (state.library) return state.library;
  const res = await fetch('/data/manga.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Не удалось загрузить каталог');
  state.library = await res.json();
  return state.library;
}

function byId(id) { return document.getElementById(id); }
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

function route() {
  const hash = location.hash || '#/';
  const [_, path, a, b, c] = hash.split('/');
  return { path, a, b, c };
}

function mount(view) {
  const root = document.getElementById('app');
  root.innerHTML = '';
  root.append(view);
}

function NotFoundView() {
  return el('div', { class: 'empty' }, 'Страница не найдена');
}

function AboutView() {
  return el('div', {}, [
    el('div', { class: 'section-title' }, [ el('h2', {}, 'О сайте'), el('span', { class: 'sub' }, 'Минималистичный ридер манги') ]),
    el('div', { class: 'kv' }, [
      el('div', {}, [ el('div', { class: 'k' }, 'Горячие клавиши'), el('div', {}, [
        el('div', {}, [ el('kbd', {}, '←'), ' / ', el('kbd', {}, '→'), ' — листать страницы' ]),
        el('div', {}, [ 'Shift + ', el('kbd', {}, '←'), ' / ', 'Shift + ', el('kbd', {}, '→'), ' — главы' ]),
        el('div', {}, [ el('kbd', {}, '+'), ' / ', el('kbd', {}, '−'), ' — ширина холста' ]),
      ])])
    ])
  ]);
}

function HomeView(library) {
  const grid = el('div', { class: 'grid' });
  if (!library.series || library.series.length === 0) {
    return el('div', { class: 'empty' }, 'Каталог пуст');
  }
  for (const s of library.series) {
    const card = el('a', { href: `#/series/${s.id}`, class: 'card' }, [
      el('div', { class: 'card-media' }, [ el('img', { src: '/' + s.cover, alt: s.title, loading: 'lazy' }) ]),
      el('div', { class: 'card-body' }, [
        el('div', { class: 'card-title' }, s.title),
        el('div', { class: 'card-meta' }, `${s.author || 'Автор неизвестен'} • ${s.chapters.length} глав`),
      ])
    ]);
    grid.append(card);
  }
  return el('section', {}, [
    el('div', { class: 'section-title' }, [
      el('h2', {}, 'Каталог'),
      el('span', { class: 'sub' }, 'Строго и лаконично')
    ]),
    grid
  ]);
}

function SeriesView(series) {
  const header = el('div', { class: 'section-title' }, [
    el('h2', {}, series.title),
    el('span', { class: 'sub' }, `${series.chapters.length} глав`)
  ]);

  const list = el('div', { class: 'list' });
  series.chapters.forEach((ch, idx) => {
    const row = el('a', {
      class: 'list-row',
      href: `#/read/${series.id}/${idx}/0`
    }, [ el('div', {}, ch.name), el('div', { class: 'pill' }, `${ch.pages.length} стр`) ]);
    list.append(row);
  });

  const info = el('div', { class: 'kv' }, [
    el('div', {}, [ el('div', { class: 'k' }, 'Автор'), el('div', {}, series.author || '—') ]),
  ]);

  return el('section', {}, [ header, info, list ]);
}

function ReaderView(series, chapterIndex, pageIndex) {
  const chapter = series.chapters[chapterIndex];
  const totalPages = chapter.pages.length;

  function goTo(nextPageIdx, nextChapterIdx = chapterIndex) {
    location.hash = `#/read/${series.id}/${nextChapterIdx}/${nextPageIdx}`;
  }

  function goPrevPage() {
    if (pageIndex > 0) goTo(pageIndex - 1);
    else if (chapterIndex > 0) goTo(series.chapters[chapterIndex - 1].pages.length - 1, chapterIndex - 1);
  }

  function goNextPage() {
    if (pageIndex < totalPages - 1) goTo(pageIndex + 1);
    else if (chapterIndex < series.chapters.length - 1) goTo(0, chapterIndex + 1);
  }

  function onKey(e) {
    if (e.key === 'ArrowLeft') { e.shiftKey ? (chapterIndex > 0 && goTo(0, chapterIndex - 1)) : goPrevPage(); }
    if (e.key === 'ArrowRight') { e.shiftKey ? (chapterIndex < series.chapters.length - 1 && goTo(0, chapterIndex + 1)) : goNextPage(); }
    if (e.key === '+') setFitWidth(Math.min(state.fitWidth + 40, 1600));
    if (e.key === '-' || e.key === '−') setFitWidth(Math.max(state.fitWidth - 40, 520));
  }

  const topbar = el('div', { class: 'reader-topbar' }, [
    el('div', { class: 'row gap-md' }, [
      el('a', { class: 'btn ghost', href: `#/series/${series.id}` }, '⟵ Назад'),
      el('div', { class: 'reader-info' }, [
        el('strong', {}, series.title),
        ' · ', chapter.name,
        ' · стр. ', (pageIndex + 1), ' / ', totalPages
      ])
    ]),
    el('div', { class: 'row gap-sm' }, [
      el('button', { class: 'btn', onclick: () => goPrevPage(), title: 'Предыдущая (←)' }, '←'),
      el('button', { class: 'btn teal', onclick: () => goNextPage(), title: 'Следующая (→)' }, '→'),
      el('span', { class: 'pill' }, ['Ширина: ', String(state.fitWidth), 'px'])
    ])
  ]);

  const imgUrl = '/' + chapter.pages[pageIndex];
  const img = el('img', { class: 'page-img', src: imgUrl, alt: `${series.title} — ${chapter.name} — стр. ${pageIndex + 1}` });

  // Preload next image
  if (pageIndex + 1 < totalPages) {
    const preload = new Image();
    preload.src = '/' + chapter.pages[pageIndex + 1];
  }

  const canvas = el('div', { class: 'reader-canvas' }, img);

  const view = el('section', { class: 'reader' }, [ topbar, canvas ]);

  const onHash = () => window.removeEventListener('keydown', onKey);
  window.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', onHash, { once: true });

  return view;
}

async function render() {
  try {
    const { path, a, b, c } = route();
    if (path === '') return mount(el('div', {}));
    if (path === '') return;

    if (path === '') { mount(HomeView(await loadLibrary())); return; }

    if (path === '#') { mount(HomeView(await loadLibrary())); return; }

    if (path === '') { mount(HomeView(await loadLibrary())); return; }

  } catch (e) {
    mount(el('div', { class: 'empty' }, 'Ошибка: ' + e.message));
  }
}

async function router() {
  try {
    const { path, a, b, c } = route();
    const lib = await loadLibrary();

    if (path === '' || path === '#') { mount(HomeView(lib)); return; }

    if (path === '') { mount(HomeView(lib)); return; }

    if (path === '') { mount(HomeView(lib)); return; }

    if (path === '') { mount(HomeView(lib)); return; }

    if (path === '') { mount(HomeView(lib)); return; }

    if (path === '') { mount(HomeView(lib)); return; }

    if (path === '') { mount(HomeView(lib)); return; }

    if (path === '') { mount(HomeView(lib)); return; }

    if (path === '') { mount(HomeView(lib)); return; }

    if (path === '') { mount(HomeView(lib)); return; }

    if (path === 'about') { mount(AboutView()); return; }

    if (path === '') { mount(HomeView(lib)); return; }

    if (path === '') { mount(HomeView(lib)); return; }

    if (path === '') { mount(HomeView(lib)); return; }

    if (path === 'series' && a) {
      const series = lib.series.find(s => s.id === a);
      if (!series) return mount(NotFoundView());
      mount(SeriesView(series));
      return;
    }

    if (path === 'read' && a && b !== undefined && c !== undefined) {
      const series = lib.series.find(s => s.id === a);
      if (!series) return mount(NotFoundView());
      const ci = parseInt(b, 10) || 0;
      const pi = parseInt(c, 10) || 0;
      mount(ReaderView(series, Math.max(0, Math.min(ci, series.chapters.length - 1)), Math.max(0, Math.min(pi, series.chapters[ci].pages.length - 1))));
      return;
    }

    // default
    mount(HomeView(lib));
  } catch (e) {
    mount(el('div', { class: 'empty' }, 'Ошибка: ' + e.message));
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);