const pathToFont = chrome.runtime.getURL('fonts/dejavu-sans-condensed-bold-webfont.woff2');
const injectedFont = new FontFace('DejaVu Sans Condensed Bold', "url(" + pathToFont + ")");

const MIN_IMG_SIZE = 128;

const passImageUrlToBackground = async (imageUrl, imageNode) => {
  const message = { action: 'fetchImage', data: imageUrl };
  chrome.runtime.sendMessage(message, (response) => {
    if (typeof response != 'undefined' && response.length > 0) {
      if (imageNode.offsetWidth > MIN_IMG_SIZE || imageNode.offsetHeight > MIN_IMG_SIZE) {
        overlayPredictionTextOverImage(response[0], imageNode);
      }
    }
    if (chrome.runtime.lastError) {
      console.warn(chrome.runtime.lastError.message);
    }
  });
}

const ensureUrlIsFullyQualified = (urlString) => {
  let link = document.createElement('a');
  link.href = urlString;
  imageUrl = link.href;
  return imageUrl;
}

let observer = new MutationSummary({
  callback: trackLazyLoadImage,
  queries: [{
    element: 'img',
  }, {
    element: '*[style]'
  }]
});

function trackLazyLoadImage(summaries) {
  let imgSummary = summaries[0];
  let styleSummary = summaries[1];

  imgSummary.added.forEach((element) => {
    urlString = element.currentSrc || element.src;
    let imageUrl = ensureUrlIsFullyQualified(urlString);
    passImageUrlToBackground(imageUrl, element);
  });

  styleSummary.added.forEach((element) => {
    if (element.style.backgroundImage) {
      let property = element.style.backgroundImage;
      let urlString = property.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
      let imageUrl = ensureUrlIsFullyQualified(urlString);
      passImageUrlToBackground(imageUrl, element);
    }
  });
}

const getImageElementWithSrcUrl = () => {
  const imgElArr = Array.from(document.getElementsByTagName('*'));
  imgElArr.forEach((element) => {
    if (element.tagName.toLowerCase() === 'img') {
      let urlString = element.currentSrc || element.src; // Check loaded src.
      let imageUrl = ensureUrlIsFullyQualified(urlString);
      passImageUrlToBackground(imageUrl, element);
    }
    else if (element.style.backgroundImage) {
      let property = element.style.backgroundImage;
      let urlString = property.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
      let imageUrl = ensureUrlIsFullyQualified(urlString);
      passImageUrlToBackground(imageUrl, element);
    }
  });
}

const init = () => {
  document.fonts.add(injectedFont);
  injectedFont.load().then(() => getImageElementWithSrcUrl(), (err) => { console.error(err) });
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
