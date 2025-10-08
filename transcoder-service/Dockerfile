FROM node:slim

WORKDIR /app

# Install FFMPEG for video processing
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Copy only the package files
COPY package*.json ./

# Install ALL dependencies first, because we need Prisma to generate the client
RUN npm ci

# Copy the rest of your app's source code
COPY . .


EXPOSE 3000

# Start the application
CMD ["npm", "start"]
