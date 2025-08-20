let apiKey = null;
const API_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate?key=';

const ART_CATEGORIES = [
  'Art',
  'Artist',
  'Artwork',
  'Art exhibition',
  'Child art',
  'Creative arts',
  'Environmental art',
  'Fractal art',
  'Line art',
  'Modern art',
  'Plastic arts',
  'Performance art',
  'Performing arts',
  'Street art',
  'Visual arts',
];

const fetchApiKey = async () => {
  try {
    const apiKeyResponse = await fetch('config.json');
    if (!apiKeyResponse.ok) {
      throw new Error(`Response status: ${apiKeyResponse.status}`);
    }

    const apiKeyJson = await apiKeyResponse.json();
    apiKey = apiKeyJson.key;
    console.log(
      '%cGot API key!',
      'background-color: white; border: 3px solid springgreen; color: red; font-size: 5em; font-style: italic; font-weight: bold;'
    );
  } catch (e) {
    console.error('Failed to fetch API key:', e);
  }
};

const filterArt = (labels) => {
  if (!labels) return [];

  console.group('Detected Labels');
  labels.forEach((label) => {
    console.log(label.score, label.description);
  });
  console.groupEnd();

  const artLabels = labels
    .filter((label) => ART_CATEGORIES.includes(label.description))
    .map((label) => `${(label.score * 100).toFixed(1)}% ${label.description}`);

  return artLabels;
};

const detectLabelsWithVisionApi = async (base64, sendResponse) => {
  if (!apiKey) await fetchApiKey();

  const labelDetectionRequest = {
    requests: [
      {
        image: { content: '' + base64 + '' },
        features: [
          {
            type: 'LABEL_DETECTION',
            maxResults: 30,
            // "model": "builtin/legacy"
          },
        ],
      },
    ],
  };

  const options = {
    method: 'POST',
    cache: 'no-cache',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(labelDetectionRequest),
  };

  try {
    const labelDetectionResponse = await fetch(
      `${API_ENDPOINT}${apiKey}`,
      options
    );
    if (!labelDetectionResponse.ok) {
      throw new Error(`HTTP error! status: ${labelDetectionResponse.status}`);
    }

    const labelDetectionJson = await labelDetectionResponse.json();
    const labelAnnotations = labelDetectionJson.responses[0].labelAnnotations;

    sendResponse(filterArt(labelAnnotations));
  } catch (e) {
    console.error('Failed to detect labels with Vision API:', e);
  }
};

const convertBlobToBase64 = async (imageBlob) => {
  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(imageBlob);
  });

  return base64Data.toString().replace(/^data:(.*,)?/, '');
};

const fetchImageBlob = async (url, sendResponse) => {
  try {
    const imageBlobResponse = await fetch(url);

    if (!imageBlobResponse.ok) {
      throw new Error(`HTTP error! status: ${imageBlobResponse.status}`);
    }

    const imageBlob = await imageBlobResponse.blob();
    const base64 = await convertBlobToBase64(imageBlob);

    detectLabelsWithVisionApi(base64, sendResponse);
  } catch (e) {
    console.error('Failed to fetch image blob for URL:', url, e);
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request) return;
  if (request.action === 'fetchImage') {
    fetchImageBlob(request.data, sendResponse);
    return true;
  }
});

// Toggle extension on icon click
// Logic adapted from Kyle McDonald’s COVID Pause (https://github.com/kylemcdonald/COVIDPause)
const toggleBadgeStatus = (isEnabled) => {
  chrome.action.setBadgeBackgroundColor({ color: 'white' });
  const badgeText = isEnabled ? '%Art' : 'Off';
  const badgeTextColor = isEnabled ? 'red' : 'gray';
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeTextColor({ color: badgeTextColor });
};

const updateExtensionStatus = (isEnabled) => {
  chrome.storage.local.set({ status: isEnabled }).then(() => {
    toggleBadgeStatus(isEnabled);
  });
};

// chrome.storage.local.get(['status']).then((defaultSetting) => {
//   if (typeof defaultSetting.status === 'undefined') {
updateExtensionStatus(false); // Always reset to disabled on background load
//   } else {
//     updateExtensionStatus(defaultSetting.status);
//   }
// });

chrome.action.onClicked.addListener(() => {
  chrome.storage.local.get(['status']).then((storedSetting) => {
    updateExtensionStatus(!storedSetting.status);
  });
});
