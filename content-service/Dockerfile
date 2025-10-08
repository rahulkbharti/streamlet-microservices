FROM node:slim

WORKDIR /app

# Copy only the package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev

# COPY the rest of the application code
COPY . /app/

EXPOSE 3000

CMD ["npm", "start"]