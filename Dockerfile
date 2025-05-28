# Build ui using node
FROM node:18.12.1

WORKDIR /app

COPY package.json .
COPY package-lock.jso[n] .
COPY src src
COPY scripts scripts
COPY tsconfig.json .
COPY .eslintrc.json .

# Install Google Chrome Stable and fonts
# Note: this installs the necessary libs to make the browser work with Puppeteer.
RUN apt-get update && apt-get install gnupg wget -y && \
    wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
    apt-get update && \
    apt-get install google-chrome-stable -y --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

RUN npm install

RUN npm run build

EXPOSE 8888

CMD ["npm","run","start"]
