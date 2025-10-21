import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";
const USERS = 100;
const BASE_URL = 'https://streamlet-api-service.whiteforest-cc5f4251.centralindia.azurecontainerapps.io/api/v1'; // Replace with your API base URL

// 🧩 Your API list
const apis = [
    {
        name: "getVideos",
        method: "GET",
        endpoint: `${BASE_URL}/videos`,
    },
    {
        name: "getVideo",
        method: "GET",
        endpoint: `${BASE_URL}/videos/Ufo7Wl3uq6P`,
    },
    {
        name: "channels",
        method: "GET",
        endpoint: `${BASE_URL}/channels`,
    },
];

// 🧠 Create a dynamic Trend metric for each API
const apiTrends = {};
apis.forEach((api) => {
    apiTrends[api.name] = new Trend(`${api.name}_duration`);
});

// ⚙️ k6 Options
export const options = {
    scenarios: {
        smoke_test: {
            executor: "constant-vus",
            vus: 1,
            duration: "10s",
        },
        load_test: {
            executor: "ramping-vus",
            startTime: "15s",
            startVUs: 0,
            stages: [
                { duration: "30s", target: USERS }, // ramp up
                { duration: "1m", target: USERS },  // hold
                { duration: "30s", target: 0 },   // ramp down
            ],
        },
    },

    thresholds: {
        http_req_failed: ["rate<0.01"], // less than 1% fail
        http_req_duration: ["p(95)<1000"], // 95% below 400ms
    },
};

// 🧩 Helper Function to send API request dynamically
function sendRequest(api) {
    let res;

    if (api.method === "GET") {
        res = http.get(api.endpoint);
    } else if (api.method === "POST") {
        res = http.post(api.endpoint, JSON.stringify(api.body || {}), {
            headers: { "Content-Type": "application/json" },
        });
    } else if (api.method === "PUT") {
        res = http.put(api.endpoint, JSON.stringify(api.body || {}), {
            headers: { "Content-Type": "application/json" },
        });
    } else if (api.method === "DELETE") {
        res = http.del(api.endpoint);
    }

    // 🧮 Record the duration for this API
    apiTrends[api.name].add(res.timings.duration);

    // ✅ Check for valid response
    check(res, {
        [`${api.name} status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
    });
}

// 🚀 Main Function
export default function () {
    // Pick a random API from the list for each iteration
    const api = apis[Math.floor(Math.random() * apis.length)];

    sendRequest(api);
    sleep(1); // realistic user delay
}
