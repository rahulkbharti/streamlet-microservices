import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = 'https://AZURE_BACKEND/api/v1';

// 1. ADD YOUR LIST OF VALID VIDEO IDS
const videoIds = [
    "sWKx9YSNBqv",
    "AcAXRHN7sTr",
    "0cO9IPBIRjX",
    "YIka31GV2b2",
];


// API list (Only the public ones we need)
const apis = [
    { name: "getVideos", method: "GET", endpoint: `${BASE_URL}/videos` },
    { name: "getVideo", method: "GET", endpoint: `${BASE_URL}/videos/` }, // Note the trailing slash
];

// Create a dynamic Trend metric for each API
const apiTrends = {};
apis.forEach((api) => {
    apiTrends[api.name] = new Trend(`${api.name}_duration`);
});

// k6 Options - A simple load test
export const options = {
    stages: [
        { duration: "20s", target: 200 }, // Ramp up to 200 users over 20 seconds
        { duration: "1m", target: 200 },  // Stay at 200 users for 1 minute
        { duration: "10s", target: 0 }, // Ramp down to 0
    ],
    thresholds: {
        'http_req_failed': ['rate<0.05'], // Fail test if more than 5% of requests fail
        'http_req_duration{name:getVideos}': ['p(95)<2000'],// 95% of getVideos under 2s
        'http_req_duration{name:getVideo}': ['p(95)<2000'], // 95% of getVideo under 2s
    },
};

// Helper Function (Simplified, no auth)
function sendRequest(api, dynamicEndpoint = null) {
    const endpoint = dynamicEndpoint || api.endpoint;
    const reqParams = {
        headers: {
            'Content-Type': 'application/json',
        },
        tags: { name: api.name } // This tags the request with the API name
    };

    const res = http.get(endpoint, reqParams);

    // Add the request duration to our custom metric
    apiTrends[api.name].add(res.timings.duration);

    // Check if the status was 2xx (e.g., 200, 201)
    check(res, { [`${api.name} status is 2xx`]: (r) => r.status >= 200 && r.status < 300 });
    return res;
}

// Main Function (This is what each Virtual User will run)
export default function () {



    const getVideosApi = apis.find(api => api.name === "getVideos");
    sendRequest(getVideosApi);

    sleep(1);


    // Only run this if we have video IDs in our list
    if (videoIds.length > 0) {
        // Pick a random video ID from the list
        const videoId = videoIds[Math.floor(Math.random() * videoIds.length)];
        const getVideoApi = apis.find(api => api.name === "getVideo");

        // Append the random video ID to the base endpoint
        const videoEndpoint = getVideoApi.endpoint + videoId;

        // Send the request
        sendRequest(getVideoApi, videoEndpoint);
    }

    sleep(2);
}