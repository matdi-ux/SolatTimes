// icon.js
// I don't want to use emoji everywhere (they look different on every OS),
// so I made little SVG files in renderer/icons/ and load them like this.

const ICON_DIR = 'icons/';

// builds an <img> string I can drop into template literals
// e.g. `${icon('clock')} 10:30`
function icon(name, alt = '') {
  return `<img class="ico" src="${ICON_DIR}${name}.svg" alt="${alt}">`;
}

// finds any <span data-icon="name"> in the page and swaps it for the real image
function applyIcons(root = document) {
  const placeholders = root.querySelectorAll('[data-icon]');

  placeholders.forEach(el => {
    const img = document.createElement('img');
    img.className = 'ico';
    img.src = ICON_DIR + el.dataset.icon + '.svg';
    img.alt = el.dataset.alt || '';
    el.replaceWith(img);
  });
}

// this script sits at the end of <body>, so the DOM is ready by now
applyIcons();