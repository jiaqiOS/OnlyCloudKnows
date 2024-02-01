const pathToFont = chrome.runtime.getURL('fonts/dejavu-sans-condensed-bold-webfont.woff2');
const injectedFont = new FontFace('DejaVu Sans Condensed Bold', "url(" + pathToFont + ")");

const passImageUrlToBackground = async (imageUrl, imageNode) => {
  const message = { action: 'fetchImage', data: imageUrl };
  chrome.runtime.sendMessage(message, (response) => {
    if (typeof response != 'undefined' && response.length > 0) {
      overlayPredictionTextOverImage(response, imageNode);
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

const overlayPredictionTextOverImage = async (textContent, image) => {
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.backgroundColor = 'transparent';
  container.style.border = '0';
  container.style.textTransform = 'capitalize';
  container.style.fontStyle = 'normal';

  const text = document.createElement('div');
  text.style.width = image.offsetWidth + 'px';
  text.style.height = image.offsetHeight + 'px';
  text.style.position = 'absolute';
  text.style.left = '0px';
  text.style.zIndex = '100';
  text.style.color = 'red';
  text.style.fontFamily = 'DejaVu Sans Condensed Bold';
  text.style.lineHeight = 'normal';
  text.style.textAlign = 'start';
  text.style.overflowWrap = 'normal';
  text.style.wordBreak = 'normal';

  const originalParent = image.parentElement;
  originalParent.insertBefore(container, image);
  container.appendChild(image);
  container.appendChild(text);

  const textChild = document.createElement('span');
  text.appendChild(textChild);

  let counter = 0;
  setInterval(() => {
    counter++;
    if (counter >= textContent.length) { counter = 0; }
    textChild.innerText = textContent[counter];
    TextFill(text, { minFontPixels: 1, maxFontPixels: 300, autoResize: true });
    text.style.top = (image.offsetHeight - textChild.offsetHeight) * 0.5 + 'px';
  }, 1000);
}
