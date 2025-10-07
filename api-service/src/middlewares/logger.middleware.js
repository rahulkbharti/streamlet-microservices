
const getDurationInMilliseconds = (start) => {
    const NS_PER_SEC = 1e9; // nanoseconds per second
    const NS_TO_MS = 1e6; // nanoseconds to milliseconds
    const diff = process.hrtime(start);
    return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS;
};

const requestLogger = (req, res, next) => {
    // Get the start time using high-resolution real time
    const start = process.hrtime();

    // Listen for the 'finish' event on the response object
    res.on("finish", () => {
        // Calculate the duration once the response is sent
        const durationInMilliseconds = getDurationInMilliseconds(start);
        console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} [${res.statusCode
            }] - ${durationInMilliseconds.toLocaleString()} ms : IP:${req.ip}`
        );
    });

    // Move to the next middleware
    next();
};

export default requestLogger;