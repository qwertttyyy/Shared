FROM node:22-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]

FROM dev AS build
RUN npm run build

FROM scratch AS static
COPY --from=build /app/dist/ /
