const cors = require("cors");
const express = require("express");
const { Initialize } = require("./pages");
const fs = require("fs");
const path = require("path");
const app = express();

app.get("/", async (req, res) => {
  res.send("Pls Dont Spam Me");
});

const sources = fs
  .readdirSync(path.join(__dirname, "sources"))
  .map((file) => path.join(__dirname, "sources", file));

sources.forEach((sourcePath) => {
  try {
    const source = require(sourcePath);
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

Initialize(1).then(() => {
  app.listen(8089, async () => {
    console.log(`http://localhost:${8089}/`);
  });
});
