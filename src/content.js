/**
 * https://stackoverflow.com/a/49821276/18513152
 * https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/add
 * https://developer.chrome.com/docs/extensions/reference/runtime/#method-getURL
 * https://github.com/web-fonts/dejavu-sans-condensed-bold
 * Another way to add fonts, injecting a style node, would cause an obvious delay.
 */
const pathToFont = chrome.runtime.getURL('fonts/dejavu-sans-condensed-bold-webfont.woff2');
const injectedFont = new FontFace('DejaVu Sans Condensed Bold', "url(" + pathToFont + ")");

const passDataToBackground = async (base64, image) => {
  const message = { action: 'fetchImage', imageData: base64 };
  chrome.runtime.sendMessage(message, (response) => {
    if (response.length >= 0) {
      if (typeof response[0] !== 'undefined') {
        console.log(response[0]);
        overlayPredictionTextOverImage(response[0], image);
      }
    }
  });
}

const loadAndEncodeImage = (imageUrl, imageNode) => {
  /**
   * NOTE: Serve the image from the cache by adding a CORS header.
   * Add a GET parameter in the URL to send a new GET request for the image when fetching the required image,
   * this will force the browser to not use the cached image from before.
   * https://www.hacksoft.io/blog/handle-images-cors-error-in-chrome 
   */
  const corsImageModified = new Image();
  corsImageModified.crossOrigin = 'Anonymous';
  corsImageModified.src = imageUrl + '?not-from-cache-please';

  corsImageModified.onerror = function () {
    console.warn(`Could not load image from external source ${imageUrl}.`);
    return;
  };

  // When image is loaded, render it to a canvas 
  // and send image data as Base64 encoded text to the background script.
  corsImageModified.onload = function () {
    // const minSize = ;
    // if ((imageNode.height && imageNode.height > minSize) || (imageNode.width && imageNode.width > minSize)) {

    // https://github.com/GoogleCloudPlatform/machine-learning-browser-extension/blob/master/chrome/background.js
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    canvas.getContext('2d').drawImage(this, 0, 0);
    const base64EncodedData = canvas.toDataURL('image/png').replace(/^data:image\/(png|jpg);base64,/, '');
    console.log(base64EncodedData);
    passDataToBackground(base64EncodedData, imageNode);
    return;
    // }
  }
}

let observer = new MutationSummary({
  callback: updateImageElement,
  queries: [{ element: 'img' }]
});

function updateImageElement(summaries) {
  let imageSummary = summaries[0];
  imageSummary.added.forEach((imageNode) => {
    imageUrl = imageNode.src;
    loadAndEncodeImage(imageUrl, imageNode);
  });
}

const getImageElementWithSrcUrl = () => {
  const imgElArr = Array.from(document.getElementsByTagName('img'));

  imgElArr.forEach((imageNode) => {
    imageUrl = imageNode.src;
    loadAndEncodeImage(imageUrl, imageNode);
  });
}

const init = () => {
  document.fonts.add(injectedFont);
  // https://developer.mozilla.org/en-US/docs/Web/API/FontFace
  injectedFont.load().then(() => getImageElementWithSrcUrl(), (err) => { console.error(err) });
}
init();

// https://github.com/dhowe/AdLiPo/blob/4e1e31e1f61210d8692abc0386c2c7083d676b77/src/js/injectTemplate.js#L181
const overlayPredictionTextOverImage = (textContent, image) => {
  const originalParent = image.parentElement; // https://stackoverflow.com/a/8685780/18513152
  const container = document.createElement('div');
  container.style.backgroundColor = 'transparent';
  container.style.border = '0';
  container.style.width = image.offsetWidth + 'px';
  container.style.height = image.offsetHeight + 'px';
  container.style.position = 'relative';
  image.style.position = 'absolute';
  // https://github.com/tensorflow/tfjs-examples/blob/ca7a661228234448284f0b3c723b41bb1ec27dcd/chrome-extension/src/content.js#L115
  originalParent.insertBefore(container, image);
  container.appendChild(image);

  const width = container.style.width;
  const height = container.style.height;
  const font = 'DejaVu Sans Condensed Bold';
  const textAlign = 'left';
  const wordBreak = 'normal';
  const lineHeight = 'normal';
  const horizontalPadding = Math.min(parseInt(Math.max(2, parseInt(width) / 15)), 20);
  const verticalPadding = Math.min(parseInt(Math.max(2, parseInt(height) / 15)), 20);
  const padding = `${verticalPadding}px ${horizontalPadding}px`;
  // https://github.com/dhowe/AdLiPo/blob/4e1e31e1f61210d8692abc0386c2c7083d676b77/src/js/injectTemplate.js#L268
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
  text.before(image);
}
