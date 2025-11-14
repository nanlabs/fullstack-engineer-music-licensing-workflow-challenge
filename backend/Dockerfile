FROM node:22-alpine

WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json ./

RUN npm install

COPY . .

ARG BACKEND_PORT=3000
ENV BACKEND_PORT=${BACKEND_PORT}

EXPOSE ${BACKEND_PORT}

CMD ["npm", "run", "start:dev"]
