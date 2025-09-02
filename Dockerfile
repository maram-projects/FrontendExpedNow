FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci  # Pas de --only=production ici

COPY . .

RUN npm run build -- --configuration=production

FROM nginx:alpine

COPY --from=build /app/dist/expednow /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]