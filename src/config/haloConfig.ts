const defaultApiUrl = "http://127.0.0.1:8090";
const configuredApiUrl = import.meta.env?.PUBLIC_HALO_API_URL;
const apiUrl: string = (configuredApiUrl || defaultApiUrl).replace(/\/+$/, "");

export const haloConfig: { apiUrl: string } = {
	apiUrl,
};
