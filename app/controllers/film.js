"use strict";
/**
 * 作品タスクコントローラー
 *
 * @namespace FilmController
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chevre_domain_1 = require("@motionpicture/chevre-domain");
const createDebug = require("debug");
const fs = require("fs-extra");
const mongoose = require("mongoose");
const request = require("request");
const debug = createDebug('chevre-jobs:controller:film');
const MONGOLAB_URI = process.env.MONGOLAB_URI;
const STATUS_CODE_OK = 200;
/**
 * @memberOf FilmController
 */
function createTicketTypeGroupsFromJson() {
    mongoose.connect(MONGOLAB_URI, {});
    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/ticketTypeGroups.json`, 'utf8', (err, data) => __awaiter(this, void 0, void 0, function* () {
        if (err instanceof Error) {
            throw err;
        }
        const groups = JSON.parse(data);
        debug('removing all groups...');
        yield chevre_domain_1.Models.TicketTypeGroup.remove({}).exec();
        debug('creating groups...');
        yield chevre_domain_1.Models.TicketTypeGroup.create(groups);
        debug('groups created.');
        mongoose.disconnect();
        process.exit(0);
    }));
}
exports.createTicketTypeGroupsFromJson = createTicketTypeGroupsFromJson;
/**
 * @memberOf FilmController
 */
function createFromJson() {
    mongoose.connect(MONGOLAB_URI, {});
    fs.readFile(`${process.cwd()}/data/${process.env.NODE_ENV}/films.json`, 'utf8', (err, data) => __awaiter(this, void 0, void 0, function* () {
        if (err instanceof Error) {
            throw err;
        }
        const films = JSON.parse(data);
        const promises = films.map((film) => __awaiter(this, void 0, void 0, function* () {
            debug('updating film...');
            yield chevre_domain_1.Models.Film.findOneAndUpdate({
                _id: film._id
            }, film, {
                new: true,
                upsert: true
            }).exec();
            debug('film updated');
        }));
        yield Promise.all(promises);
        debug('promised.');
        mongoose.disconnect();
        process.exit(0);
    }));
}
exports.createFromJson = createFromJson;
/**
 * 作品画像を取得する
 *
 * @memberOf FilmController
 */
function getImages() {
    mongoose.connect(MONGOLAB_URI, {});
    chevre_domain_1.Models.Film.find({}, 'name', { sort: { _id: 1 } }, (err, films) => {
        if (err !== null) {
            throw err;
        }
        let i = 0;
        const next = (film) => {
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
                            debug('image saved.', error);
                            if (errorOfImageRequest !== null && responseOfImageRequest.statusCode === STATUS_CODE_OK) {
                                // tslint:disable-next-line:max-line-length
                                fs.writeFileSync(`${__dirname}/../../../../public/images/film/${film.get('_id').toString()}.jpg`, bodyOfImageRequest, 'binary');
                            }
                            if (i === films.length - 1) {
                                debug('success!');
                                mongoose.disconnect();
                                process.exit(0);
                            }
                            else {
                                i += 1;
                                next(films[i]);
                            }
                        });
                    }
                    else {
                        i += 1;
                        next(films[i]);
                    }
                }
                else {
                    if (i === films.length - 1) {
                        debug('success!');
                        mongoose.disconnect();
                        process.exit(0);
                    }
                    else {
                        i += 1;
                        next(films[i]);
                    }
                }
            });
        };
        next(films[i]);
    });
}
exports.getImages = getImages;
