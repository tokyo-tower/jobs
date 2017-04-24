/**
 * 作品タスクコントローラー
 *
 * @namespace FilmController
 */

import { Models } from '@motionpicture/chevre-domain';

import * as createDebug from 'debug';
import * as fs from 'fs-extra';
import * as log4js from 'log4js';
import * as mongoose from 'mongoose';
import * as request from 'request';

const debug = createDebug('chevre-api:task:controller:film');

const MONGOLAB_URI = process.env.MONGOLAB_URI;
const STATUS_CODE_OK = 200;

// todo ログ出力方法考える
log4js.configure({
    appenders: [
        {
            category: 'system',
            type: 'console'
        }
    ],
    levels: {
        system: 'ALL'
    },
    replaceConsole: true
});
const logger = log4js.getLogger('system');

/**
 * @memberOf FilmController
 */
export function createTicketTypeGroupsFromJson(): void {
    mongoose.connect(MONGOLAB_URI, {});

    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypeGroups.json`, 'utf8', async (err, data) => {
        if (err instanceof Error) throw err;
        const groups = JSON.parse(data);

        logger.info('removing all groups...');
        await Models.TicketTypeGroup.remove({}).exec();

        logger.debug('creating groups...');
        await Models.TicketTypeGroup.create(groups);
        logger.info('groups created.');
        mongoose.disconnect();
        process.exit(0);
    });
}

/**
 * @memberOf FilmController
 */
export function createFromJson(): void {
    mongoose.connect(MONGOLAB_URI, {});

    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/films.json`, 'utf8', async (err, data) => {
        if (err instanceof Error) throw err;
        const films: any[] = JSON.parse(data);

        const promises = films.map(async (film) => {
            logger.debug('updating film...');
            await Models.Film.findOneAndUpdate(
                {
                    _id: film._id
                },
                film,
                {
                    new: true,
                    upsert: true
                }
            ).exec();
            logger.debug('film updated');
        });

        await Promise.all(promises);
        logger.info('promised.');
        mongoose.disconnect();
        process.exit(0);
    });
}

/**
 * 作品画像を取得する
 *
 * @memberOf FilmController
 */
export function getImages() {
    mongoose.connect(MONGOLAB_URI, {});

    Models.Film.find({}, 'name', { sort: { _id: 1 } }, (err, films) => {
        if (err !== null) throw err;

        let i = 0;

        const next = (film: mongoose.Document) => {
            const options = {
                url: `https://api.cognitive.microsoft.com/bing/v5.0/images/search?q=${encodeURIComponent(film.get('name.ja'))}`,
                json: true,
                headers: {
                    'Ocp-Apim-Subscription-Key': '3bca568e7b684e218eb2a11d0cdce9c0'
                }
            };

            // let options = {
            //     url: `https://api.photozou.jp/rest/search_public.json?limit=1&keyword=${encodeURIComponent(film.get('name').ja)}`,
            //     json: true
            // };

            debug('searching...', film.get('name').ja);
            request.get(options, (error, response, body) => {
                if (error !== null && response.statusCode === STATUS_CODE_OK) {
                    if (body.value.length > 0) {
                        const image = body.value[0].thumbnailUrl;
                        debug('thumbnailUrl:', image);

                        request.get({ url: image, encoding: null }, (errorOfImageRequest, responseOfImageRequest, bodyOfImageRequest) => {
                            logger.debug('image saved.', error);
                            if (errorOfImageRequest !== null && responseOfImageRequest.statusCode === STATUS_CODE_OK) {
                                // tslint:disable-next-line:max-line-length
                                fs.writeFileSync(`${__dirname}/../../../../public/images/film/${film.get('_id').toString()}.jpg`, bodyOfImageRequest, 'binary');
                            }

                            if (i === films.length - 1) {
                                logger.debug('success!');
                                mongoose.disconnect();
                                process.exit(0);
                            } else {
                                i += 1;
                                next(films[i]);
                            }
                        });
                    } else {
                        i += 1;
                        next(films[i]);
                    }
                } else {
                    if (i === films.length - 1) {
                        logger.debug('success!');
                        mongoose.disconnect();
                        process.exit(0);
                    } else {
                        i += 1;
                        next(films[i]);
                    }
                }
            });
        };

        next(films[i]);
    });
}
