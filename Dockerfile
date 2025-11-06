FROM node:20-alpine

# Set working directory
WORKDIR /app

# for dependencies
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
