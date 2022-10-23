let apiKey;

// https://www.youtube.com/watch?v=tc8DU14qX6I&list=PLRqwX-V7Uu6YxDKpFzf_2D84p0cyk4T7X&index=3
const fetchApiKey = async () => {
  const response = await fetch('config.json');
  const object = await response.json();
  apiKey = object.key;
}

fetchApiKey()
  .then(response => console.log('gotApiKey'))
  .catch(err => console.error(err.message));

const filter = {
  properties: ["pinned"]
}

try {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab, filter) => {
    if (changeInfo.status == 'complete') {
      chrome.scripting.executeScript({
        files: ['src/content.js'],
        target: { tabId: tab.id }
      });
    }
  })
} catch (err) {
  console.log(err);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request) { return; }
  if (request.action === 'fetchImage') {
    console.log(request.imageData);
    analyzeImage(request, sendResponse);
    return true;
  }
});

const analyzeImage = (request, sendResponse) => {
  /** 
   * Set up the POST request.
   * NOTE: The Cloud Vision API is a REST API that uses HTTP POST operations 
   * to perform data analysis on images you send in the request.
   * https://cloud.google.com/vision/docs/request#json_request_format
   * https://cloud.google.com/vision/docs/base64#mac-osx
   */
  const annotateImageRequest = {
    "requests": [
      {
        "image": {
          "content": "" + request.imageData + "" // https://forum.uipath.com/t/how-to-use-variable-from-loop-in-http-request-body/201590/4
        },
        "features": [
          {
            "type": "LABEL_DETECTION",
            "maxResults": 50
          }
        ]
      }
    ]
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
  // https://www.youtube.com/watch?v=Kw5tC5nQMRY&list=PLRqwX-V7Uu6YxDKpFzf_2D84p0cyk4T7X&index=11
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(annotateImageRequest)
  };

  const visionApiEndpoint = 'https://vision.googleapis.com/v1/images:annotate?key=';
  const visionApiRequest = visionApiEndpoint + apiKey; // https://cloud.google.com/docs/authentication/api-keys

  fetch(visionApiRequest, options)
    .then((annotateImageResponse) => {
      if (!annotateImageResponse.ok) {
        console.error('Error');
        return;
      }

      annotateImageResponse.json() // The json function also returns a promise.
        .then((labelDetection) => {
          const labels = labelDetection.responses[0].labelAnnotations;

          let predictions = [];

          for (let i = 0; i < labels.length; i++) {
            const label = labels[i].description;
            const confidenceScore = Math.floor(labels[i].score * 100) + '%';

            const regex = new RegExp('(?:^|\W)Art(?:$|\W)');
            const hasArtLabel = regex.test(label);
            let annotation = {};
            if (hasArtLabel) {
              annotation = confidenceScore + ' ' + label;
              predictions.push(annotation);
            }
          }
          sendResponse(predictions);
        });
    })
    .catch(err => console.error('Error:', err.message));
}