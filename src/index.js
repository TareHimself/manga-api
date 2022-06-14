const cors = require('cors');
const express = require('express');
const { Initialize, getPage, closePage } = require('./pages');
const app = express();
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
const port = process.argv.includes('debug') ? 8089 : 8089;
const tasks = {
  search: new Map(),
  getChapters: new Map(),
  readChapters: new Map(),
};

app.get('/', async (req, res) => {

});

app.get('/search', async (req, res) => {

  const q = (req.query.q || '').trim();
  const id = req.query.id;

  if (!id) {
    res.send('All request require an identifier param "id"');
    return;
  }



  const loader = getPage();

  if (tasks.search.get(id)) {
    console.log("Stopping duplicate task");
    tasks.search.get(id).cancel();
  }

  tasks.search.set(id, loader);

  loader.onLoaded(async (page) => {

    tasks.search.delete(id);
    let result = [];

    if (q === '') {
      result = await page.evaluate(async () => {

        const elements = Array.from(document.querySelectorAll('.latest_item'));

        return elements.map((element) => {
          const id = element.querySelector('a[class=\'name\']').getAttribute("href").split('\/')[2];
          const chaptersString = element.querySelector('.chapter_box').children[0].textContent;

          console.log(id)
          const tags = null;

          return {
            id: id,
            name: element.querySelector(':scope > a[class=\'name\']').textContent,
            cover: `https://images.mangafreak.net/manga_images/${id.toLowerCase()}.jpg`,
            chapters: chaptersString.slice(chaptersString.indexOf('r ') + 1).trim(),
            tags: tags,
          }

        });
      });
    }
    else {
      result = await page.evaluate(async () => {

        const elements = Array.from(document.querySelectorAll('.manga_result .manga_search_item span h3')).map(element => element.parentElement);

        return elements.map((element) => {
          const id = element.querySelector('h3 a').getAttribute("href").split('\/')[2];
          const chaptersString = element.querySelector('div').textContent;

          const tags = Array.from(element.querySelectorAll(':scope > div a')).map(aTag => aTag.textContent);

          return {
            id: id,
            name: element.querySelector('h3 a').textContent,
            cover: `https://images.mangafreak.net/manga_images/${id.toLowerCase()}.jpg`,
            chapters: chaptersString.slice(1, chaptersString.indexOf('Chapters')).trim(),
            tags: tags,
          }

        });
      });
    }



    res.send(result);

    console.log(page ? "Sucess" : "Cancled")
    await closePage(page);
  })

  loader.onCancled(() => {

  })

  if (q === '') {
    loader.load(`https://w13.mangafreak.net/`);
  }
  else {
    loader.load(`https://w13.mangafreak.net/Search/${encodeURIComponent(q)}`);
  }

});

app.get('/chapters/:manga', async (req, res) => {
  const manga = req.params.manga || '';
  const loader = getPage();
  loader.onLoaded(async (page) => {

    const result = await page.evaluate(async () => {

      return Array.from(document.querySelectorAll('.manga_series_list > table tbody tr')).map(element => {
        const text = element.children[0].children[0].innerText;
        return text.slice(text.indexOf(' ')).trim().split(' ')[0].trim()
      })
    });

    res.send(result);

    await closePage(page);
  })

  loader.onCancled(() => {

  })

  loader.load(`https://w13.mangafreak.net/Manga/${encodeURIComponent(manga)}`);

});

app.get('/chapters/:manga/:number', async (req, res) => {
  const manga = (req.params.manga || '').toLocaleLowerCase();
  const chapter = req.params.number || "1";

  const loader = getPage();

  loader.onLoaded(async (page) => {
    const result = await page.evaluate(async (manga, chapter) => {

      const lastPage = parseInt(document.querySelector('.read_selector').textContent.split('of')[1].trim(), 10);

      const baseUrl = `https://images.mangafreak.net/mangas/${encodeURIComponent(manga)}/${encodeURIComponent(manga)}_${chapter}/${encodeURIComponent(manga)}_${chapter}_{index}.jpg`
      return { base: baseUrl, total: lastPage };
    }, manga, chapter);

    res.send(result);

    await closePage(page);
  })

  loader.onCancled(() => {

  })

  loader.load(`https://w13.mangafreak.net/Read1_${encodeURIComponent(manga)}_${chapter}`)


});

app.listen(port, async () => {
  await Initialize(1);
  console.log(`http://localhost:${port}/`)
});