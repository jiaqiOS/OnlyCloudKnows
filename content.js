/**
 * https://stackoverflow.com/a/49821276/18513152
 * https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/add
 * https://developer.chrome.com/docs/extensions/reference/runtime/#method-getURL
 * https://github.com/web-fonts/dejavu-sans-condensed-bold
 */
const pathToFont = chrome.runtime.getURL('fonts/dejavu-sans-condensed-bold-webfont.woff2');
const injectedFont = new FontFace('DejaVu Sans Condensed Bold', 'url(pathToFont)');
document.fonts.add(injectedFont);

const passDataToBackground = (base64, imageNode) => {
  const message = { action: 'fetchImage', imageData: base64 };
  chrome.runtime.sendMessage(message, (response) => {
    if (response.length >= 0) {
      // console.log(response[0]);
      addTextElementToImageNode(response[0], imageNode);
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
    // console.log(base64EncodedData);
    passDataToBackground(base64EncodedData, imageNode);
    return;
    // }
  }
}

const getImageElementWithSrcUrl = () => {
  const imgElArr = Array.from(document.getElementsByTagName('img'));

  imgElArr.forEach((imageNode) => {
    imageUrl = imageNode.src;
    loadAndEncodeImage(imageUrl, imageNode);
  });
}

getImageElementWithSrcUrl();

// https://github.com/dhowe/AdLiPo/blob/4e1e31e1f61210d8692abc0386c2c7083d676b77/src/js/injectTemplate.js#L181
const addTextElementToImageNode = (textContent, imageNode) => {
  const originalParent = imageNode.parentElement; // https://stackoverflow.com/a/8685780/18513152

  const container = document.createElement('div');
  container.style.backgroundColor = 'transparent';
  container.style.border = '0';
  container.style.width = imageNode.offsetWidth + 'px';
  container.style.height = imageNode.offsetHeight + 'px';
  container.style.position = 'relative';
  imageNode.style.position = 'absolute';
  // https://github.com/tensorflow/tfjs-examples/blob/ca7a661228234448284f0b3c723b41bb1ec27dcd/chrome-extension/src/content.js#L115
  originalParent.insertBefore(container, imageNode);
  container.appendChild(imageNode);

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
  container.style.fontWeight = 'normal';
  container.style.textAlign = textAlign;
  container.style.fontSize = fontSize;
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
  text.before(imageNode);
}

// https://github.com/dhowe/AdLiPo/blob/4e1e31e1f61210d8692abc0386c2c7083d676b77/src/js/injectTemplate.js#L268
const computeFontSize = (textContent, width, height, font, textAlign, wordBreak, lineHeight, padding, tryLimit) => {
  textContent = textContent.trim();
  let css = {}, cssStr;
  const getRealHeight = () => {
    testEl.style.fontSize = guess + 'px';
    document.body.appendChild(testEl);
    realHeight = testEl.clientHeight;
    testEl.parentNode.removeChild(testEl);
  }

  const targetWidth = parseFloat(width.slice(0, -1).slice(0, -1));
  const targetHeight = parseFloat(height.slice(0, -1).slice(0, -1));
  const contentLength = textContent.length;
  const testEl = document.createElement('div');
  testEl.style.wordBreak = 'normal';
  testEl.style.textAlign = 'left';
  let lastDirection;
  const last5 = [];
  let tries = 0;
  let cross = 0;

  let guess = (Math.sqrt(targetWidth * targetHeight / contentLength));
  cssStr = 'height: auto;display: block!important;width: ' + width + '!important;padding: ' + padding + ';font-size: ' + guess + 'px;font-family: ' + font + ';text-align: ' + textAlign + ';word-break: ' + wordBreak + ';line-height: ' + lineHeight + ';';

  testEl.setAttribute('style', cssStr);
  testEl.innerText = textContent;
  document.body.appendChild(testEl);
  let realHeight = testEl.clientHeight;
  testEl.parentNode.removeChild(testEl);

  while (tries < tryLimit && Math.abs(realHeight - targetHeight) > Math.max(0.05 * targetHeight, 5)) {
    let gap = targetHeight - realHeight;

    if (gap > 0 !== lastDirection) cross++;
    if (cross > 3) {
      guess = last5.sort((a, b) => {
        return b - a
      })[0];
      getRealHeight();
      break;
    }
    lastDirection = gap > 0;
    guess += (gap * guess) / realHeight;

    if (guess < 1) {
      guess = 1;
      getRealHeight();
      break;
    }
    getRealHeight();
    if (last5.length >= 5) last5.shift();
    last5.push(guess);
    tries++;
  }
  guess = guess.toFixed(2);
  while (realHeight > targetHeight) {
    guess -= 0.1;
    getRealHeight();
  }
  return guess + 'px';
}