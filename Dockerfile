FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 4201

CMD ["npx", "ember", "serve", "--host", "0.0.0.0", "--port", "4201"]
