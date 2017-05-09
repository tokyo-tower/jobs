/**
 * テストタスクコントローラー
 *
 * @namespace controller/test
 */

import { CommonUtil } from '@motionpicture/ttts-domain';

import * as conf from 'config';
import * as createDebug from 'debug';
import * as querystring from 'querystring';
import * as request from 'request';

const debug = createDebug('ttts-jobs:controller:test');

/**
 *
 * @memberOf controller/test
 */
export function checkFullWidthLetter() {
    // tslint:disable-next-line:max-line-length
    const filmName = '作家性の萌芽　1999-2003 （細田守監督短編集）『劇場版デジモンアドベンチャー』『劇場版デジモンアドベンチャー　ぼくらのウォーゲーム！』『村上隆作品　SUPERFLAT MONOGRAM』『村上隆作品　The Creatures From Planet 66 ～Roppongi Hills Story～』『おジャ魔女どれみドッカ～ン！（40話）』『明日のナージャ（OP、ED）』';
    const filmNameFullWidth = CommonUtil.toFullWidth(filmName);
    let registerDisp1 = '';
    // tslint:disable-next-line:prefer-for-of no-increment-decrement
    for (let i = 0; i < filmNameFullWidth.length; i++) {
        const letter = filmNameFullWidth[i];
        if (
            letter.match(/[Ａ-Ｚａ-ｚ０-９]/) !== null
            || letter.match(/[\u3040-\u309F]/) !== null // ひらがな
            || letter.match(/[\u30A0-\u30FF]/) !== null // カタカナ
            || letter.match(/[一-龠]/) !== null // 漢字
        ) {
            registerDisp1 += letter;
        }
    }
    debug(registerDisp1);

    process.exit(0);
}

export function getBounces(): void {
    const query = querystring.stringify({
        api_user: conf.get<string>('sendgrid_username'),
        api_key: conf.get<string>('sendgrid_password'),
        date: '1'
        // start_date: "2016-10-18",
        // end_date: "2016-10-19"
    });
    request.get(
        {
            url: `https://api.sendgrid.com/api/bounces.get.json?${query}`
            // url: `https://api.sendgrid.com/api/blocks.get.json?${query}`
            // url: `https://api.sendgrid.com/api/invalidemails.get.json?${query}`
            // url: `https://api.sendgrid.com/api/spamreports.get.json?${query}`
        },
        (error, response, body) => {
            debug('request processed.', error, response, body);
            process.exit(0);
        }
    );
}
