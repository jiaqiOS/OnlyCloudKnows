const computeFontSize = (textContent, width, height, font, textAlign, wordBreak, lineHeight, padding, tryLimit) => {
    textContent = textContent.toString();
    let css = {}, cssStr;
    const getRealHeight = () => {
      testEl.style.fontSize = guess + 'px';
      document.body.appendChild(testEl);
      realHeight = testEl.offsetHeight;
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
    let realHeight = testEl.offsetHeight;
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
