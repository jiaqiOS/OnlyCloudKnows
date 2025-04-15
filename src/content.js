const PATH_TO_FONT = chrome.runtime.getURL('fonts/dejavu-sans-condensed-bold-webfont.woff2');
let mutationObserver, intersectionObservers = [];

const overlayAnnotationsOverImage = (annotations, image) => {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'relative',
    border: '0',
    backgroundColor: 'transparent'
  });

  const text = document.createElement('div');
  text.className = 'annotations';
  Object.assign(text.style, {
    position: 'absolute',
    zIndex: '100',
    width: `${image.offsetWidth}px`,
    height: `${image.offsetHeight}px`,
    left: '0',
    color: 'red',
    fontFamily: 'DejaVu Sans Condensed Bold',
    fontStyle: 'normal',
    textTransform: 'capitalize',
    textAlign: 'start',
    lineHeight: 'normal',
    wordBreak: 'normal',
    overflowWrap: 'normal'
  });

  const originalParent = image.parentElement;
  originalParent.insertBefore(container, image);
  container.appendChild(image);
  container.appendChild(text);

  const textChild = document.createElement('span');
  text.appendChild(textChild);

  let counter = 0;
  let start;

  const animate = (timestamp) => {
    if (start === undefined) start = timestamp;

    if (timestamp - start >= 1000) {
      counter++;
      if (counter >= annotations.length) {
        counter = 0;
      }
      textChild.innerText = annotations[counter];

      TextFill(text, {
        minFontPixels: 1,
        maxFontPixels: 300,
        autoResize: true
      });

      text.style.top = `${(image.offsetHeight - textChild.offsetHeight) * 0.5}px`;

      start = timestamp;
    }

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
};

const passImageUrlToBackground = (imageUrl, imageElement) => {
  const message = {
    action: 'fetchImage',
    data: imageUrl
  };

  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      console.warn(chrome.runtime.lastError.message);
    } else if (response && response.length > 0) {
      overlayAnnotationsOverImage(response, imageElement);
    }
  });
};

const getImageElementWithUrl = (element) => {
  if (element.offsetWidth < 60 || element.offsetHeight < 60) return;

  let imageUrl = '';
  if (element.tagName.toLowerCase() === 'img') {
    imageUrl = new URL(element.currentSrc || element.src, window.location.href).href;
  } else if (element.style.backgroundImage) {
    const backgroundImageUrl = element.style.backgroundImage.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
    imageUrl = new URL(backgroundImageUrl, window.location.href).href;
  }

  if (imageUrl) {
    passImageUrlToBackground(imageUrl, element);
  }
};

const checkVisibility = (targetElements) => {
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        getImageElementWithUrl(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    rootMargin: '0px',
    threshold: 0.5
  });

  targetElements.forEach((el) => {
    observer.observe(el);
  });

  intersectionObservers.push(observer);
};

const trackLazyLoading = (summaries) => {
  const summary = summaries[0];
  checkVisibility(summary.added);
};

const setup = async () => {
  const font = new FontFace('DejaVu Sans Condensed Bold', `url(${PATH_TO_FONT})`);

  try {
    await font.load();
    document.fonts.add(font);

    const elements = document.querySelectorAll('img, *[style]');
    checkVisibility(elements);

    mutationObserver = new MutationSummary({
      callback: trackLazyLoading,
      queries: [{
        element: 'img, *[style]'
      }]
    });
  } catch (error) {
    console.error(error);
  }
};

const teardown = () => {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }

  intersectionObservers.forEach(observer => observer.disconnect());
  intersectionObservers = [];

  const annotations = document.getElementsByClassName('annotations');
  while (annotations.length > 0) {
    annotations[0].parentNode.removeChild(annotations[0]);
  }
};

chrome.storage.local.get(['status']).then((storedSetting) => {
  if (storedSetting.status) {
    setup();
  }
});

chrome.storage.onChanged.addListener((changes) => {
  const changedItems = Object.keys(changes);

  for (const item of changedItems) {
    if (changes[item].newValue) {
      setup();
    } else {
      teardown();
    }
  }
});