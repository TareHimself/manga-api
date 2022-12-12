const { Initialize } = require("./pages");
const fs = require("fs");
const path = require("path");
const process = require('process')
const express = require('express')
const { Client } = require('express-websocket-proxy')

const bUseSockets = !process.argv.includes('--sockets')

const app = bUseSockets ? new Client("wss://proxy.oyintare.dev") : express();
const PATH_PREFIX = bUseSockets ? 'manga/' : '/';

const sourcesInstances = [];
const sources = fs
  .readdirSync(path.join(__dirname, "sources"))
  .map((file) => path.join(__dirname, "sources", file));


sources.forEach((sourcePath) => {
  try {
    const source = require(sourcePath);

    sourcesInstances.push(source);
    app.get(`${PATH_PREFIX}${source.id}/search`, source.search.bind(source));
    app.get(`${PATH_PREFIX}${source.id}/manga/:manga`, source.getManga.bind(source));
    app.get(`${PATH_PREFIX}${source.id}/chapters/:manga/`, source.getChapters.bind(source));
    app.get(`${PATH_PREFIX}${source.id}/chapters/:manga/:number`,
      source.getChapter.bind(source)
    );
  } catch (error) {
    console.log(sourcePath, error);
  }
});

app.get(PATH_PREFIX, async (req) => {
  req.sendBody(sourcesInstances.map(source => ({ id: source.id, name: source.name })));
});

Initialize(1).then(() => {
  if (bUseSockets) {
    app.connect()
    console.log('Connected to', app.url)
  } else {
    app.listen(8089, async () => {
      console.log(`http://localhost:${8089}/`);
    });
  }

});
