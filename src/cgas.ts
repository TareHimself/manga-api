import FormData from 'form-data';
import { ICgasApiResponse, IFileToUpload } from './types';
import { importFetch } from './utils';

export class CgasApi {
	static instance?: CgasApi;
	static get() {
		if (this.instance) return this.instance;
		this.instance = new CgasApi();
		return this.instance;
	}

	async upload(files: IFileToUpload[]): Promise<ICgasApiResponse[] | null> {
		const fetch = (await importFetch()).default;

		try {
			const form = new FormData();

			files.forEach((a) => form.append('file[]', a.data, a.filename));

			form.append('key', process.env.CGAS_API_KEY);

			form.append('custom_url', 'https://files.oyintare.dev');

			const uploadResponse = await fetch('https://cgas.io/api/upload', {
				method: 'POST',
				body: form,
			}).then((a) => a.json() as Promise<ICgasApiResponse[]>);

			return uploadResponse;
		} catch (error) {
			console.error(error);
		}
		return null;
	}
}
