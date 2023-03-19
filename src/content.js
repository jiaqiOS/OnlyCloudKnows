const pathToFont = chrome.runtime.getURL('fonts/dejavu-sans-condensed-bold-webfont.woff2');
const injectedFont = new FontFace('DejaVu Sans Condensed Bold', "url(" + pathToFont + ")");

const passImageUrlToBackground = async (imageUrl, imageNode) => {
  const message = { action: 'fetchImage', data: imageUrl };
  chrome.runtime.sendMessage(message, (response) => {
    if (typeof response != 'undefined' && response.length > 0) {
      overlayPredictionTextOverImage(response[0], imageNode);
    }
    if (chrome.runtime.lastError) {
      console.warn(chrome.runtime.lastError.message);
    }
  });
}

const getImageElementWithUrl = (element) => {
  if (element.offsetWidth === undefined || element.offsetHeight === undefined) { return; }
  if (element.offsetWidth < 60 || element.offsetHeight < 60) { return; }

  if (element.tagName.toLowerCase() === 'img') {
    let urlString = element.currentSrc || element.src;
    let imageUrl = new URL(urlString, window.location.href).href;
    passImageUrlToBackground(imageUrl, element);
  }
  else if (element.style.backgroundImage) {
    let property = element.style.backgroundImage;
    let urlString = property.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
    let imageUrl = new URL(urlString, window.location.href).href;
    passImageUrlToBackground(imageUrl, element);
  }
}

let mutationObserver = new MutationSummary({
  callback: trackLazyLoading,
  queries: [{ element: 'img, *[style]' }]
});

function trackLazyLoading(summaries) {
  let summary = summaries[0];
  checkVisibility(summary.added);
}

const checkVisibility = (targets) => {
  let intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const element = entry.target;
        getImageElementWithUrl(element);
        intersectionObserver.unobserve(element);
      }
    });
  });
  targets.forEach(el => { intersectionObserver.observe(el); })
}

const init = () => {
  document.fonts.add(injectedFont);
  let targetElements = document.querySelectorAll('img, *[style]');
  injectedFont.load().then(() => checkVisibility(targetElements), (err) => { console.error(err) });
}
init();

const overlayPredictionTextOverImage = (textContent, image) => {
  const originalParent = image.parentElement;
  let nextSibling = image.nextElementSibling;
  const container = document.createElement('div');
  container.style.backgroundColor = 'transparent';
  container.style.border = '0';
  container.style.width = image.offsetWidth + 'px';
  container.style.height = image.offsetHeight + 'px';
  container.style.position = 'relative';
  image.style.position = 'absolute';
  originalParent.insertBefore(container, image);
  container.appendChild(image);
  if (nextSibling != null) {
    container.appendChild(nextSibling);
  }

  const width = container.style.width;
  const height = container.style.height;
  const font = 'DejaVu Sans Condensed Bold';
  const textAlign = 'left';
  const wordBreak = 'normal';
  const lineHeight = 'normal';
  const horizontalPadding = Math.min(parseInt(Math.max(2, parseInt(width) / 15)), 20);
  const verticalPadding = Math.min(parseInt(Math.max(2, parseInt(height) / 15)), 20);
  const padding = `${verticalPadding}px ${horizontalPadding}px`;
  const fontSize = computeFontSize(textContent, width, height, font, textAlign, wordBreak, lineHeight, padding, 100);

  container.style.color = 'red';
  container.style.fontFamily = font;
  container.style.fontSize = fontSize;
  container.style.fontWeight = 'normal';
  container.style.textAlign = textAlign;
  container.style.wordBreak = wordBreak;
  container.style.lineHeight = lineHeight;
  container.style.display = 'table';

  const text = document.createElement('div');
  text.style.display = 'table-cell';
  text.style.verticalAlign = 'middle';
  text.style.position = 'absolute';
  text.style.padding = padding;
  text.innerText = textContent;
  container.appendChild(text);
}