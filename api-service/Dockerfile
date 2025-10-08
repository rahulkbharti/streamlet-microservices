FROM node:slim

WORKDIR /app

# Copy only the package files
COPY package*.json ./

# Install ALL dependencies first, because we need Prisma to generate the client
RUN npm ci

# Copy the rest of your app's source code
# This includes your schema.prisma file 
COPY . .

# Generate the Prisma Client during the image build
# This bakes the generated client right into your image
RUN npx prisma generate

# (Optional but Recommended) Prune devDependencies to keep the final image smaller
RUN npm prune --production

EXPOSE 3000

# The CMD is now much simpler and only starts the application
CMD ["npm", "start"]