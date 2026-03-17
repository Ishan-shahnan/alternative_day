# Use the official Node.js image as our base
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first (for caching)
COPY package*.json ./

# Install dependencies, including sqlite3 which might need some build tools
RUN apk add --no-cache python3 make g++ && npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (Render assigns process.env.PORT automatically, but defaults to 3000)
EXPOSE 3000

# Start the Node server
CMD ["node", "server.js"]
