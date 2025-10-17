import mongoose from "mongoose";
const ConnectMongoose = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected [mongoose]");
    } catch (e) {
        console.log("❌ MongoDB [mongoose] Connection Error:", e);
    }
}

export default ConnectMongoose;