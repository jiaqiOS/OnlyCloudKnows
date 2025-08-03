const FONT_NAME = 'DejaVu Sans Condensed Bold';
const PATH_TO_FONT = chrome.runtime.getURL(
  'fonts/dejavu-sans-condensed-bold-webfont.woff2'
);
const PARENT_CLASSNAME = 'ock-extension-parentElement';
const CONTAINER_CLASSNAME = 'ock-extension-injectedContainer';
const IMAGE_CLASSNAME = 'ock-extension-labeledImage';
const MIN_IMAGE_SIZE = 60;

const PROCESSED_IMAGE_URLS = new Set();
let mutationObserver = null;
let intersectionObservers = [];
let animationFrameIds = [];

const createContainer = () => {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'relative',
    border: '0',
    backgroundColor: 'transparent',
  });
  return container;
};

const createTextDiv = (image) => {
  const textDiv = document.createElement('div');
  Object.assign(textDiv.style, {
    position: 'absolute',
    zIndex: 100,
    width: `${image.offsetWidth}px`,
    height: `${image.offsetHeight}px`,
    left: '0',
    color: 'red',
    fontFamily: `${FONT_NAME}`,
    fontStyle: 'normal',
    textTransform: 'capitalize',
    textAlign: 'start',
    lineHeight: 'normal',
    wordBreak: 'normal',
    overflowWrap: 'normal',
  });
  return textDiv;
};

const fitAndCenterTextInImage = (image, textDiv, textSpan) => {
  TextFill(textDiv, {
    minFontPixels: 1,
    maxFontPixels: 300,
    autoResize: true,
    success: () => {
      textDiv.style.top = `${
        (image.offsetHeight - textSpan.offsetHeight) * 0.5
      }px`;
    },
    fail: () => {
      console.warn('Unable to resize text for image:', image);
    },
  });
};

const cycleLabels = (image, labels, textDiv, textSpan) => {
  let counter = 0;
  let start;

  const updateLabelFrame = (timestamp) => {
    if (start === undefined) start = timestamp;

    if (timestamp - start >= 1000) {
      counter++;
      if (counter >= labels.length) {
        counter = 0;
      }
      textSpan.innerText = labels[counter];
      fitAndCenterTextInImage(image, textDiv, textSpan);

      start = timestamp;
    }

    requestAnimationFrame(updateLabelFrame);
  };
  const id = requestAnimationFrame(updateLabelFrame);
  animationFrameIds.push(id);
};

const overlayArtLabelsOverImage = (image, labels) => {
  const parentElement = image.parentElement;
  parentElement.classList.add(PARENT_CLASSNAME);
  image.classList.add(IMAGE_CLASSNAME);
  const container = createContainer();
  container.className = CONTAINER_CLASSNAME;
  const textDiv = createTextDiv(image);
  const textSpan = document.createElement('span');

  parentElement.insertBefore(container, image);
  container.appendChild(image);
  container.appendChild(textDiv);
  textDiv.appendChild(textSpan);

  cycleLabels(image, labels, textDiv, textSpan);
};

const requestLabelDetectionForImage = (image, url) => {
  const message = { action: 'fetchImage', data: url };

  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      console.warn(chrome.runtime.lastError.message);
    } else if (response && response.length > 0) {
      overlayArtLabelsOverImage(image, response);
    }
  });
};

const processUrlIfNew = (url) => {
  if (url && !PROCESSED_IMAGE_URLS.has(url)) {
    PROCESSED_IMAGE_URLS.add(url);
    return true;
  }
  return false;
};

const extractImageUrlFrom = (element) => {
  if (
    element.offsetWidth < MIN_IMAGE_SIZE ||
    element.offsetHeight < MIN_IMAGE_SIZE
  ) {
    return;
  }

  let url = '';
  try {
    if (element.tagName.toLowerCase() === 'img') {
      url = new URL(element.currentSrc || element.src, window.location.href)
        .href;
    } else if (element.style.backgroundImage) {
      const backgroundImageUrl = element.style.backgroundImage
        .replace(/^url\(["']?/, '')
        .replace(/["']?\)$/, '');
      url = new URL(backgroundImageUrl, window.location.href).href;
    }
  } catch (e) {
    console.warn(
      'Unable to construct valid image URL from element:',
      element,
      e
    );
  }

  if (processUrlIfNew(url)) {
    requestLabelDetectionForImage(element, url);
  }
};

const observeVisible = (elements) => {
  const observer = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          extractImageUrlFrom(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      rootMargin: '0px',
      threshold: 0.5,
    }
  );
  elements.forEach((element) => observer.observe(element));
  intersectionObservers.push(observer);
};

const handleAddedElements = (summaries) => {
  const summary = summaries[0];
  observeVisible(summary.added);
};

let isWebFontLoaded = false;

const loadWebFont = async () => {
  if (isWebFontLoaded) return;
  const webfont = new FontFace(FONT_NAME, `url(${PATH_TO_FONT})`);
  await webfont.load();
  document.fonts.add(webfont);
  isWebFontLoaded = true;
};

const setup = async () => {
  try {
    await loadWebFont();
  } catch (e) {
    console.error('Failed to load DejaVu font', e);
  }

  const elements = document.querySelectorAll('img, *[style]');
  observeVisible(elements);

  try {
    mutationObserver = new MutationSummary({
      callback: handleAddedElements,
      queries: [{ element: 'img, *[style]' }],
    });
  } catch (e) {
    console.error('Failed to initialize MutationSummary:', e);
  }
};

const disconnectObservers = () => {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }

  intersectionObservers.forEach((observer) => observer.disconnect());
  intersectionObservers = [];
};

const removeOverlaysAndRestoreImages = () => {
  const parentElements = document.getElementsByClassName(PARENT_CLASSNAME);
  while (parentElements.length > 0) {
    const parentElement = parentElements[0];
    const containers =
      parentElement.getElementsByClassName(CONTAINER_CLASSNAME);
    while (containers.length > 0) {
      const container = containers[0];
      const image = container.getElementsByClassName(IMAGE_CLASSNAME)[0];
      if (image) {
        parentElement.insertBefore(image, container);
        parentElement.removeChild(container);
        image.classList.remove(IMAGE_CLASSNAME);
      }
    }
    parentElement.classList.remove(PARENT_CLASSNAME);
  }
};

const teardown = () => {
  disconnectObservers();
  removeOverlaysAndRestoreImages();

  PROCESSED_IMAGE_URLS.clear();

  animationFrameIds.forEach((id) => cancelAnimationFrame(id));
  animationFrameIds = [];
};

chrome.storage.local.get(['status']).then((storedSetting) => {
  if (storedSetting.status) setup();
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
