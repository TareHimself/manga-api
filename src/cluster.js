const cors = require("cors");
const express = require("express");
const { Initialize } = require("./pages");
const fs = require("fs");
const path = require("path");
const app = express();

const sourcesInstances = [];
const sources = fs
  .readdirSync(path.join(__dirname, "sources"))
  .map((file) => path.join(__dirname, "sources", file));

sources.forEach((sourcePath) => {
  try {
    const source = require(sourcePath);

    sourcesInstances.push(source);

    app.get(`/${source.id}/search`, source.search.bind(source));
    app.get(`/${source.id}/:manga`, source.getManga.bind(source));
    app.get(`/${source.id}/:manga/chapters/`, source.getChapters.bind(source));
    app.get(
      `/${source.id}/:manga/chapters/:number`,
      source.getChapter.bind(source)
    );
  } catch (error) {
    console.log(sourcePath, error);
  }
});

app.get('/', async (req, res) => {
  res.send(sourcesInstances.map(source => ({ id: source.id, name: source.name })));
});

Initialize(1).then(() => {
  app.listen(8089, async () => {
    console.log(`http://localhost:${8089}/`);
  });
});
