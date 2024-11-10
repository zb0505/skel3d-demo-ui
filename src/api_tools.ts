import * as bootstrap from "bootstrap"

// Read file as data URL and display preview
export function fileToDataUrl(file: File): Promise<string> {
	return new Promise(resolve => {
		const reader = new FileReader()
		reader.addEventListener("load", event => resolve(event.target?.result as string))
		reader.readAsDataURL(file)
	})
}

// Convert data URL to blob
export function dataUrlToBlob(dataUrl: string): Blob {
	const bytes = atob(dataUrl.split(",")[1])
	const mimeType = dataUrl.split(",")[0].split(":")[1].split(";")[0]
	const buffer = new ArrayBuffer(bytes.length)
	const uintArr = new Uint8Array(buffer)
	for (let i = 0; i < bytes.length; i++) uintArr[i] = bytes.charCodeAt(i)
	return new Blob([buffer], { type: mimeType })
}

// Tooltip tools
let tooltipList = [] as bootstrap.Tooltip[]
export function updateTooltips() {
	tooltipList.forEach(tooltip => tooltip.dispose())
	const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
	tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => bootstrap.Tooltip.getOrCreateInstance(tooltipTriggerEl))
}


// Model inputs
export type Point = [x: number, y: number]
interface SupportPoints {
	positive: Point[]
	negative: Point[]
}
interface SAM2Input {
	image: string,
	points: SupportPoints
}

interface CapeXInput {
	image: string,
	keypoints: string[]
}

interface Skel3DInput {
	image: string,
	skeleton: string
}

// Model responses
interface SAM2Response { segmentation: string }
interface CapeXResponse { skeleton: string }
interface Skel3DResponse { prediction: string }

// API endpoint definitions
interface APIInputs {
	"/segmentate": SAM2Input,
	"/skeleton": CapeXInput,
	"/skel3d": Skel3DInput
}
interface APIOutputs {
	"/segmentate": SAM2Response,
	"/skeleton": CapeXResponse,
	"/skel3d": Skel3DResponse
}

// API response types
interface APIResponse<P extends keyof APIOutputs> {
	status: number,
	json: APIOutputs[P]
}


// API class
export default class API {
	/** Base API URL */
	static apiURL: string = import.meta.env.API_URL || "http://localhost:8000"

	/** Fetches the requested resource */
	private static fetch<P extends keyof APIInputs>(path: P, body: APIInputs[P]): Promise<APIResponse<P>> {
		(path as string) = path.startsWith("/") ? path : `/${path}`
		const apiUrl = this.apiURL.replace(/\/$/, "")
		return fetch(apiUrl + path, {
			headers: { "Content-Type": "application/json" },
			method: "POST", body: JSON.stringify(body)
		}).then(async r => ({ status: r.status, json: await r.json() })) as any
	}

	/**
	 * Segmentates the given image with the given support points
	 * @param image The input image as base64
	 * @param points Support points for SAM2
	 * @returns The segmentation image as base64
	 */
	public static async segmentate(image: string, points: SupportPoints): Promise<string> {
		const resp = await this.fetch("/segmentate", { image, points })
		if (resp.status !== 200) return ""
		return resp.json.segmentation
	}

	/**
	 * Creates a 3D skeleton for the given image
	 * @param image The input image as base64
	 * @param keypoints Textual description of keypoints on the image
	 * @returns The skeleton OBJ file URL
	 */
	public static async skeleton(image: string, keypoints: string[]): Promise<string> {
		const resp = await this.fetch("/skeleton", { image, keypoints })
		if (resp.status !== 200) return ""
		return resp.json.skeleton
	}

	/**
	 * Creates the view of the input object from the direction specified by the given skeleton
	 * @param image The segmentated input image as base64
	 * @param skeleton The target view skeleton as base64
	 * @returns The generated view as base64
	 */
	public static async skel3D(image: string, skeleton: string): Promise<string> {
		const resp = await this.fetch("/skel3d", { image, skeleton })
		if (resp.status !== 200) return ""
		return resp.json.prediction
	}
}