import * as fs from 'fs'
import path from 'path'
import { Client } from 'express-websocket-proxy';
import { MangaSource } from './mangaSource';

const app = new Client("manga", "wss://proxy.oyintare.dev");

const sourcesInstances: MangaSource[] = [];
const sources = fs
  .readdirSync(path.join(__dirname, "sources"))
  .map((file) => path.join(__dirname, "sources", file));


sources.forEach((sourcePath) => {
  try {
    const source = require(sourcePath).default as MangaSource;

    sourcesInstances.push(source);
    app.get(`/${source.id}/search`, source.search.bind(source));
    app.get(`/${source.id}/manga/:manga`, source.getManga.bind(source));
    app.get(`/${source.id}/chapters/:manga/`, source.getChapters.bind(source));
    app.get(`/${source.id}/chapters/:manga/:chapterId`,
      source.getChapter.bind(source)
    );
  } catch (error) {
    console.log(sourcePath, error);
  }
});

app.get("/", async (req) => {
  req.send(sourcesInstances.map(source => ({ id: source.id, name: source.displayName })));
});

app.connect()
console.log('Connected to', app.url)
