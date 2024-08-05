import { XXHash64 } from 'xxhash-addon';
import { IApiImage } from './types';

export function buildResponse<T>(data: T) {
	return {
		data,
		error: null,
	};
}

export function buildErrorResponse(data: string) {
	return {
		data: null,
		error: data,
	};
}

export const importDynamic = new Function(
	'modulePath',
	'return import(modulePath)'
);

export async function importFetch() {
	return importDynamic('node-fetch') as typeof import('node-fetch');
}

const CORRECT_DATE_REGEX = /^[0-9]{4}\s[0-9]{2}\s[0-9]{2}$/;

export function isValidDateString(date: string) {
	return CORRECT_DATE_REGEX.test(date);
}

export function validateOrNullDate(date: string) {
	return CORRECT_DATE_REGEX.test(date) ? date : null;
}

export function quickHash(data: Buffer) {
	return XXHash64.hash(Buffer.from(data)).toString('hex');
}

export function pad(data: string) {
	if (data.length === 1) {
		return `0${data}`;
	}
	return data;
}
const DATE_TYPE_1_REGEX = /([a-zA-Z]{3,9})[,\-\s]?([0-9]{1,2})[,\-\s]?[,\-\s]?([0-9]{2,4})/;
const DATE_TYPE_2_REGEX = /^(\d{4})[-/](\d{2})[-/](\d{2})/;
const DATE_TYPE_3_REGEX = /^([0-9]{1,2}) (second|minute|month|year|week|hour|day)s?(?:\s?ago)$/i
const MONTH_TO_NUMBER: Record<string, string> = {
	jan: '01',
	feb: '02',
	mar: '03',
	apr: '04',
	may: '05',
	jun: '06',
	jul: '07',
	aug: '08',
	sep: '09',
	oct: '10',
	nov: '11',
	dec: '12',
	january: '01',
	february: '02',
	march: '03',
	april: '04',
	june: '06',
	july: '07',
	august: '08',
	september: '09',
	october: '10',
	november: '11',
	december: '12',
};
export function extractAndFormatDate(originalDate: string) {
	if (CORRECT_DATE_REGEX.test(originalDate)) {
		
		return originalDate;
	}

	if (DATE_TYPE_1_REGEX.test(originalDate)) {
		const [month, day, year] = originalDate
			.match(DATE_TYPE_1_REGEX)
			?.slice(1) ?? [undefined, undefined, undefined];

		if (month && MONTH_TO_NUMBER[month.trim().toLocaleLowerCase()] && day && year) {
			return validateOrNullDate(
				`${year.length <= 2 ? "20" : ""}${year.length <= 2 ? pad(year).toString() : year} ${pad(MONTH_TO_NUMBER[month.trim().toLocaleLowerCase()]!)} ${pad(day)}`
			);
		}
	}

	if (DATE_TYPE_2_REGEX.test(originalDate)) {
		
		const match = originalDate.match(DATE_TYPE_2_REGEX);
		if (!match) return null;

		const [year, month, day] = match.slice(1);

		return validateOrNullDate(`${year} ${month} ${day}`);
	}

	if(DATE_TYPE_3_REGEX.test(originalDate)){
		const match = originalDate.match(DATE_TYPE_3_REGEX)
		if(!match) return null

		const now = new Date()
		
		const [diff,unit] = match.slice(1).map(a => a.toLowerCase())

		if(unit === 'second')
		{
			now.setSeconds(now.getSeconds() - parseInt(diff ?? ''))
		}
		else if(unit === 'minute')
		{
			now.setMinutes(now.getMinutes() - parseInt(diff ?? ''))
		}
		else if(unit === 'hour')
		{
			now.setHours(now.getHours() - parseInt(diff ?? ''))
		}
		else if(unit === 'day')
		{
			now.setHours(now.getHours() - (parseInt(diff ?? '') * 24))
		}
		else if(unit === 'week')
		{
			now.setHours(now.getHours() - (parseInt(diff ?? '') * 7 * 24))
		}
		else if(unit === 'month')
		{
			now.setMonth(now.getMonth() - parseInt(diff ?? ''))
		}
		else if(unit === 'year')
		{
			now.setFullYear(now.getFullYear() - parseInt(diff ?? ''))
		}


		return validateOrNullDate(`${now.getUTCFullYear()} ${pad(now.getUTCMonth().toString())} ${pad(now.getUTCDate().toString())}`)
	}

	return null;
}


export function makeApiImage(src: string, headers: Record<string, string> = {}) : IApiImage {
	const keys = Object.keys(headers);
	return {
		src: src,
		headers: keys.reduce((total, current) => {
			total.push({ key: current, value: headers[current] ?? ''});
			return total;
		}, [] as IApiImage['headers'])
	}
}

export function assert(assertion: boolean,message: string){
	if(!assertion){
		throw new Error(message);
	}
	return
}
