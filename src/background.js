let apiKey;

const fetchApiKey = async () => {
  const response = await fetch('config.json');
  const object = await response.json();
  apiKey = object.key;
}

fetchApiKey()
  .then(response => console.log('gotApiKey'))
  .catch(err => console.error(err.message));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request) { return; }
  if (request.action === 'fetchImage') {
    loadAndEncodeImage(request.data, sendResponse);
    return true;
  }
});

const loadAndEncodeImage = (url, sendResponse) => {
  fetch(url, {
    method: 'GET',
    mode: 'no-cors'
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.blob();
    })
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => { resolve(reader.result); }
      reader.onerror = error => reject(error);
      reader.readAsDataURL(blob);
    }))
    .then((result) => {
      const base64String = result.toString().replace(/^data:(.*,)?/, '');
      return base64String;
    })
    .then(base64String => analyzeImage(base64String, sendResponse))
    .catch(err => console.error(err.message));
}

const analyzeImage = (base64String, sendResponse) => {
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
          "content": "" + base64String + "" // https://forum.uipath.com/t/how-to-use-variable-from-loop-in-http-request-body/201590/4
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
    mode: 'cors',
    cache: 'no-cache',
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return annotateImageResponse.json();
    })
    .then((labelDetection) => {
      const labels = labelDetection.responses[0].labelAnnotations;

      let predictions = [];
      if (typeof labels != 'undefined') {
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
      }
      sendResponse(predictions);
    })
    .catch(err => console.error(err.message));
}
