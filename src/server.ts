import express from 'express';
import { SourceManager } from './source';
import { pageCache, requestCache } from './cache';
import { assert, buildErrorResponse, buildResponse } from './utils';
import { IManga } from './types';
import winston from 'winston';
import expressWinston from 'express-winston';

const apiVersion = 1;

const sourceManager = new SourceManager();

const app = express();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(expressWinston.logger({
	transports: [
	  new winston.transports.Console(),
	],
	format: winston.format.combine(
	  winston.format.colorize(),
	  winston.format.cli()
	),
	meta: true, // optional: control whether you want to log the meta data about the request (default to true)
	msg: "HTTP {{req.method}} {{req.url}}", // optional: customize the default logging message. E.g. "{{res.statusCode}} {{req.method}} {{res.responseTime}}ms {{req.url}}"
	expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
	colorize: false, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
	// ignoreRoute: function (req, res) { return false; } // optional: allows to skip some log messages based on request and/or response
  }));


app.get(`/pages/:pageId`,async (req,res)=>{
    try {
        const cacheId = req.params.pageId
        const pagePath = await pageCache.get(cacheId,Infinity,false)

        if(pagePath){
            res.setHeader('Content-Type','image/png')
            res.sendFile(pagePath)
            return
        }
    } catch (error) {
        console.error(error)
    }
    res.sendStatus(404)
})

// app.get(`/page/:pageId`,async (req,res)=>{
//     const fetch = (await importFetch()).default

//     try {
//         const cacheId = req.params.pageId
//         const pagePath = await pageCache.get(cacheId,Infinity,false)

//         if(pagePath){
//             res.setHeader('Content-Type','image/png')
//             res.sendFile(pagePath)
//             return
//         }
//         else{
//             const proxyPath = await proxyCache.get(cacheId,Infinity,false)
//             if(proxyPath){
//                 const proxyData: IProxyData = JSON.parse(await fsPromises.readFile(proxyPath,'ascii'))

//                 const fetchResponse = await fetch(proxyData['url'],{
//                     headers: {
//                         "User-Agent" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
//                     ...proxyData['headers']}
//                 })

//                 if(fetchResponse.body){

//                     // await fetch(proxyData['url'],{
//                     //     headers: {
//                     //         "User-Agent" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
//                     //     ...proxyData['headers']}
//                     // }).then(a => {
//                     //     res.setHeader('Content-Type','image/jpeg')
//                     //     res.setHeader("Content-Length",a.headers.get("content-length")!)
//                     //     a.body?.pipe(res)
//                     // })

//                     res.setHeader('Content-Type','image/jpeg')
//                     res.setHeader("Content-Length",fetchResponse.headers.get("content-length")!)
//                     fetchResponse.body.pipe(res)
//                     await pageCache.cache(cacheId,fetchResponse.body,false)
//                     return
//                 }
//             }
//         }
//     } catch (error) {
//         console.error(error)
//     }
//     res.sendStatus(404)
// })
app.get(`/api/v${apiVersion}`, async (_req, res) => {
	const data = Array.from(sourceManager.sources.values()).sort((a,b)=>{
		if(a.name.toLowerCase() === b.name.toLowerCase()){
			return 0
		}

		if(a.name.toLowerCase() < b.name.toLowerCase()){
			return -1
		}

		return 1
	}).map((source) => {
		return {
			id: source.id,
			name: source.name,
			nsfw: source.nsfw,
		};
	});

	res.send(buildResponse(data));
});

app.get(`/api/v${apiVersion}/:sourceId`, async (req, res) => {
	try {
		const sourceId = req.params.sourceId;

		const source = sourceManager.getSource(sourceId);

		if (!source) {
			throw new Error('Source does not exist');
		}

		const data = await source.handleSearch(
			req.query.query as string | undefined,
			req.query.page as string | undefined
		);

		res.send(buildResponse(data));
	} catch (error) {
		if (error instanceof Error) {
			res.send(buildErrorResponse(error.message));
		} else {
			res.send(buildErrorResponse('An unknown error has occured'));
		}
		console.error(error);
	}
});


app.get(`/api/v${apiVersion}/:sourceId/:mangaId`, async (req, res) => {
	try {
		const sourceId = req.params.sourceId;
		const mangaId = req.params.mangaId;

		const source = sourceManager.getSource(sourceId);

		if (!source) {
			throw new Error('Source does not exist');
		}

		const data: IManga = {
			...(await source.handleManga(mangaId)),
			id: encodeURIComponent(mangaId),
		};

		assert(data.name.trim().length !== 0,"Manga has no name and is possibly invalid")

		assert(data.cover !== undefined && data.cover.src.trim().length !== 0,"Manga has no cover and is possibly invalid");

		assert(data.share.trim().length !== 0,"Manga has no share url and is possibly invalid")

		res.send(buildResponse(data));
	} catch (error) {
		if (error instanceof Error) {
			res.send(buildErrorResponse(error.message));
		} else {
			res.send(buildErrorResponse('An unknown error has occured'));
		}
		console.error(error);
	}
});

app.get(`/api/v${apiVersion}/:sourceId/:mangaId/chapters`, async (req, res) => {
	try {
		const sourceId = req.params.sourceId;
		const mangaId = req.params.mangaId;

		const source = sourceManager.getSource(sourceId);

		if (!source) {
			throw new Error('Source does not exist');
		}

		const data = await source.handleChapters(mangaId);

		res.send(buildResponse(data));
	} catch (error) {
		if (error instanceof Error) {
			res.send(buildErrorResponse(error.message));
		} else {
			res.send(buildErrorResponse('An unknown error has occured'));
		}
		console.error(error);
	}
});

app.get(
	`/api/v${apiVersion}/:sourceId/:mangaId/chapters/:chapterId`,
	async (req, res) => {
		try {
			const sourceId = req.params.sourceId;
			const mangaId = req.params.mangaId;
			const chapterId = req.params.chapterId;

			const source = sourceManager.getSource(sourceId);

			if (!source) {
				throw new Error('Source does not exist');
			}
			const cacheKey = `<--${sourceId}|${mangaId}|${chapterId}-->`;

			const cachedResponsePath = await requestCache.get(
				cacheKey,
				5 * 60 * 60 * 1000//5 hours //Infinity
			);

			if (cachedResponsePath) {
				res.setHeader('Content-Type', 'application/json');
				res.sendFile(cachedResponsePath);
				return;
			}

			const data = await source.handleChapter(mangaId, chapterId);

			const response = buildResponse(data);

			if (data.length > 0) {
				await requestCache.cache(
					cacheKey,
					Buffer.from(JSON.stringify(response, null, 4))
				);
			}

			res.send(response);
		} catch (error) {
			if (error instanceof Error) {
				res.send(buildErrorResponse(error.message));
			} else {
				res.send(buildErrorResponse('An unknown error has occured'));
			}
			console.error(error);
		}
	}
);

app.get(/.*/,(_,res)=>{
	res.redirect("https://www.urbandictionary.com/define.php?term=L%20bozo")
})

sourceManager.loadSources().then(() => {
	app.listen(process.argv.includes("--debug") ? 10000 : 8888, async () => {
		console.log('Server online');
	});
});
