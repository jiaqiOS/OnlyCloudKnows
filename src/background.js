let API_KEY;
const API_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate?key=';

const fetchApiKey = async () => {
  try {
    const apiKeyResponse = await fetch('config.json');
    if (!apiKeyResponse.ok) {
      throw new Error(`Response status: ${apiKeyResponse.status}`);
    }

    const apiKeyJson = await apiKeyResponse.json();
    API_KEY = apiKeyJson.key;
    // console.log('gotApiKey');
  } catch (error) {
    console.error(error.message);
  }
};

fetchApiKey();

const analyzeImage = async (base64String, sendResponse) => {
  const labelDetectionRequest = {
    "requests": [{
      "image": {
        "content": "" + base64String + ""
      },
      "features": [{
        "type": "LABEL_DETECTION",
        "maxResults": 50,
        // "model": "builtin/legacy"
      }]
    }]
  };

  const options = {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(labelDetectionRequest)
  };

  try {
    const labelDetectionResponse = await fetch(`${API_ENDPOINT}${API_KEY}`, options);
    if (!labelDetectionResponse.ok) {
      throw new Error(`HTTP error! status: ${labelDetectionResponse.status}`);
    }

    const labelDetectionJson = await labelDetectionResponse.json();
    const labels = labelDetectionJson.responses[0].labelAnnotations;

    let annotations = [];
    if (labels) {
      for (const label of labels) {
        const category = label.description;
        // console.log(category);
        const score = (label.score * 100).toFixed(1) + '%';
        if (['Art', 'Artist', 'Artwork', 'Art exhibition', 'Creative arts', 'Environmental art', 'Fractal art', 'Line art', 'Modern art', 'Plastic arts', 'Performance art', 'Performing arts', 'Street art', 'Visual arts'].includes(category)) {
          annotations.push(`${score} ${category}`);
        }
      }
    }
    sendResponse(annotations);
  } catch (error) {
    console.error(error.message);
  }
};

const loadAndEncodeImage = async (url, sendResponse) => {
  try {
    const imageBlobResponse = await fetch(url, {
      method: 'GET',
      mode: 'no-cors'
    });

    if (!imageBlobResponse.ok) {
      throw new Error(`HTTP error! status: ${imageBlobResponse.status}`);
    }

    const imageBlob = await imageBlobResponse.blob();
    const blobToBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(imageBlob);
    });

    const base64String = blobToBase64.toString().replace(/^data:(.*,)?/, '');
    analyzeImage(base64String, sendResponse);
  } catch (error) {
    console.error(error.message);
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request) return;
  if (request.action === 'fetchImage') {
    loadAndEncodeImage(request.data, sendResponse);
    return true;
  }
});

// Toggle extension on icon click
// Logic adapted from Kyle McDonald’s COVID Pause (https://github.com/kylemcdonald/COVIDPause)
const toggleBadgeStatus = (isEnabled) => {
  chrome.action.setBadgeBackgroundColor({ color: 'white' });
  const badgeText = isEnabled ? '%Art' : 'Off';
  const badgeTextColor = isEnabled ? 'red' : 'blue';
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeTextColor({ color: badgeTextColor });
};

const updateExtensionStatus = (isEnabled) => {
  chrome.storage.local.set({ status: isEnabled }).then((() => {
    toggleBadgeStatus(isEnabled);
  }));
};

chrome.storage.local.get(['status']).then((defaultSetting) => {
  if (!defaultSetting.status || !!defaultSetting.status) {
    updateExtensionStatus(false);
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get(['status']).then((storedSetting) => {
    updateExtensionStatus(!storedSetting.status);
  });
});
