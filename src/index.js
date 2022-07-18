const cors = require('cors');
const express = require('express');
const { EventEmitter } = require('events');
const { Initialize, getPage, closePage } = require('./pages');
const app = express();
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
const port = process.argv.includes('debug') ? 8089 : 8089;

function startNewTask(req, loader) {

  const path = req._parsedUrl.pathname;
  const id = req.query.id;


  if (!tasks.get(path)) tasks.set(path, new Map());

  console.log('started new task', path)
  tasks.get(path).set(id, loader);
}

function clearTaskIfExists(req) {

  const path = req._parsedUrl.pathname;
  const id = req.query.id;

  if (!tasks.get(path)) tasks.set(path, new Map());

  const activeLoader = tasks.get(path).get(id);

  if (!activeLoader) return;
  console.log('cleared task', path)
  tasks.get(path).delete(id);
}

app.get('/', async (req, res) => {
  res.send('Pls Dont Spam Me')
});

app.use((req, res, next) => {

  next();
})

app.get('/search', async (req, res) => {
  console.time('Search Request')
  const q = (req.query.q || '').trim();

  const loader = getPage();


  loader.onLoaded(async (page) => {


    try {

      let result = [];
      console.time(`Query for ${q}`);
      if (q === '') {


        result = await page.evaluate(() => {

          /* Fetches only popular
          return Array.from(document.querySelectorAll('.popular-item-wrap')).map((element) => {
            const aTag = element.querySelector('.widget-title a');
            const img = element.querySelector('.widget-title a');
            return {
              id: aTag.href.split('\/'),
              title: aTag.textContent,
              cover: element.querySelector('img').src,
            }
          });*/

          return Array.from(document.querySelectorAll('.page-item-detail.manga')).map((element) => {
            const aTagBeforeImage = element.querySelector('.item-thumb.c-image-hover a');

            return {
              id: aTagBeforeImage.href.split('\/')[4],
              title: element.querySelector('.item-summary .post-title.font-title h3 a').textContent,
              cover: aTagBeforeImage.children[0].getAttribute('data-src'),

            }
          })

        });

      }
      else {
        result = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.row.c-tabs-item__content')).map((element) => {
            const imageElement = element.querySelector('img');
            const titleATag = element.querySelector('.post-title h3 a')

            return {
              id: titleATag.href.split('\/')[4],
              title: titleATag.textContent,
              cover: imageElement.getAttribute('data-src'),

            }
          });
        });
      }

      console.timeEnd(`Query for ${q}`);

      if (!loader.bWascancelled) {
        res.send(result);
        console.timeEnd('Search Request')
      }

    } catch (error) {
      console.log(error.message)
      res.send('Error test stopped execution')
    }

    await closePage(page);
  });

  loader.onCancelled(() => {
    console.log('Request cancelled')
    console.timeEnd('Search Request')
  });

  if (q === '') {
    loader.load(`https://mangaclash.com/`, '.site-content');
  }
  else {
    loader.load(`https://mangaclash.com/?post_type=wp-manga&s=${encodeURIComponent(q)}`, '.site-content');
  }

  req.once('close', function (err) {
    loader.cancel();
  });
});

app.get('/manga/:manga', async (req, res) => {
  const manga = req.params.manga || '';
  const loader = getPage();

  loader.onLoaded(async (page) => {

    const result = await page.evaluate(async () => {

      const aTag = document.querySelector('.summary_image a');

      return {
        id: aTag.href.split('\/')[4],
        title: document.querySelector('.post-title h1').textContent.slice(1),
        cover: aTag.children[0].getAttribute('data-src'),
        tags: Array.from(document.querySelectorAll('.genres-content a')).map(e => e.textContent),
        status: document.querySelector('.post-status .post-content_item .summary-content').textContent.replace('\n', '').replace('\t', ''),
        description: document.querySelector('p').textContent

      }
    });

    if (!loader.bWascancelled) {
      res.send(result);
    }

    await closePage(page);
  })

  loader.onCancelled(() => {

  });

  loader.load(`https://mangaclash.com/manga/${encodeURIComponent(manga)}/`, '.site-content');

  req.once('close', function (err) {
    loader.cancel();
  });
});

app.get('/manga/:manga/chapters/', async (req, res) => {
  const manga = req.params.manga || '';
  const loader = getPage();

  loader.onLoaded(async (page) => {

    const result = await page.evaluate(async () => {
      const items = []


      return Array.from(document.querySelectorAll('.wp-manga-chapter a')).map(a => a.href.split('\/').reverse()[1].slice(8).replaceAll('-', '.')).filter((a) => {
        const comparison = !items.includes(a);
        if (comparison) items.push(a);
        return comparison;
      });
    });

    if (!loader.bWascancelled) {
      res.send(result);
    }

    await closePage(page);
  })

  loader.onCancelled(() => {

  });

  loader.load(`https://mangaclash.com/manga/${encodeURIComponent(manga)}/`, '.site-content');

  req.once('close', function (err) {
    loader.cancel();
  });
});

app.get('/manga/:manga/chapters/:number', async (req, res) => {
  const manga = (req.params.manga || '').toLocaleLowerCase();
  const chapter = req.params.number || "1";

  const loader = getPage();

  loader.onLoaded(async (page) => {

    const result = await page.evaluate(async (manga, chapter) => {

      return Array.from(document.querySelectorAll('.reading-content .page-break.no-gaps img')).map(img => img.getAttribute('data-src').replaceAll('\n', '').replaceAll('\t', ''))
    }, manga, chapter);

    if (!loader.bWascancelled) {
      res.send(result);
    }

    await closePage(page);
  })

  loader.onCancelled(() => {

  });

  loader.load(`https://mangaclash.com/manga/${encodeURIComponent(manga)}/chapter-${encodeURIComponent(chapter)}/`, '.site-content')

  req.once('close', function (err) {
    loader.cancel();
  });

});

app.listen(port, async () => {
  await Initialize(1);
  console.log(`http://localhost:${port}/`)
});
