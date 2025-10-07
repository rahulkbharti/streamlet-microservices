import jwt from "jsonwebtoken";
import dotenv from "dotenv";
<<<<<<< HEAD
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
=======
dotenv.config({ path: ".env.development" });
const accessTokenSecret = process.env.JWT_ACCESS_SECRET || "s";
const refreshTokenSecret = process.env.JWT_REFRESH_SECRET || "r";
// const accessTokenExpiresIn = process.env.JWT_EXPIRES_IN || "15m";
const accessTokenExpiresIn = "1d";
const refreshTokenExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
export const createAccessToken = (payload) => {
    if (!accessTokenSecret || !accessTokenExpiresIn) {
        console.error("JWT secret or access token expiration time is not defined in environment variables.");
        throw new Error("Server configuration error: JWT settings are missing.");
    }
    const signOptions = {
        expiresIn: accessTokenExpiresIn,
        algorithm: "HS256",
    };
    return jwt.sign({ ...payload }, accessTokenSecret, signOptions);
};
export const createRefreshToken = (payload) => {
    if (!refreshTokenSecret || !refreshTokenExpiresIn) {
        console.error("JWT secret or refresh token expiration time is not defined in environment variables.");
        throw new Error("Server configuration error: JWT settings are missing.");
    }
    const signOptions = {
        expiresIn: refreshTokenExpiresIn,
        algorithm: "HS256",
    };
    return jwt.sign({ ...payload }, refreshTokenSecret, signOptions);
};
export const verifyAccessToken = async (token) => {
    if (!accessTokenSecret) {
        console.error("JWT access secret is not defined in environment variables.");
        throw new Error("Server configuration error: JWT settings are missing.");
    }
    try {
        const decode = jwt.verify(token, accessTokenSecret);
        // console.log(decode);
        return decode;
    }
    catch (error) {
        // console.error("Failed to verify access token:", error);
        return null;
    }
};
export const verifyRefreshToken = async (token) => {
    if (!refreshTokenSecret) {
        console.error("JWT refresh secret is not defined in environment variables.");
        throw new Error("Server configuration error: JWT settings are missing.");
    }
    try {
        return jwt.verify(token, refreshTokenSecret);
    }
    catch (error) {
        // console.error("Failed to verify refresh token:", error);
        return null;
    }
};
const createTokens = (payload) => {
    const accessToken = createAccessToken(payload);
    const refreshToken = createRefreshToken(payload);
    return { accessToken, refreshToken };
};
export default createTokens;
>>>>>>> 7a5264de227d3ad26e9840117ecbbdcf2cd30b3b
