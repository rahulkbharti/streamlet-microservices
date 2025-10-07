import crypto from 'crypto';

export const generateUsername = (email) => {
    const namePart = email.split('@')[0];
    const randomId = crypto.randomBytes(3).toString('hex'); // 6 random hex chars
    return `${namePart}${randomId}`;
};

// // Example
// console.log(generateUsername('rahul@gmail.com')); // rahul#f3a2b1
