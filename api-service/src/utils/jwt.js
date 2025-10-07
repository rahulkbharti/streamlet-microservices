import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config({ path: '.env.development' });

// Generate Access Token (short lifespan)
const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email },  // payload
        process.env.ACCESS_TOKEN_SECRET,     // secret
        { expiresIn: '1d' }                 // token lifespan
    );
};

// Generate Refresh Token (long lifespan)
const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
    );
};

// Verify Access Token
const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
        return null;
    }
};
// Verify Refresh Token
const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
        return null;
    }
};

const generateTokens = (user) => {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    return { accessToken, refreshToken };
}
export {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    generateTokens
};
