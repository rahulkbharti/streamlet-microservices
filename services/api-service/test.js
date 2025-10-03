function generateYouTubeLikeId(length = 11) {
    // The character set includes URL-safe characters (Base64url).
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    let result = '';

    // Loop 'length' times to build the random string.
    for (let i = 0; i < length; i++) {
        // Pick a random character from the 'chars' string.
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars[randomIndex];
    }

    return result;
}

console.log(generateYouTubeLikeId()); // Example usage