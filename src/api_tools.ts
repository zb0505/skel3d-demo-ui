import * as bootstrap from "bootstrap"


// Utility functions
export class Utils {
	/** Tooltip list for updating them */
	private static tooltipList = [] as bootstrap.Tooltip[]
	
	/** Updates all tooltips on the page */
	static updateTooltips(): void {
		this.tooltipList.forEach(tooltip => tooltip.dispose())
		const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
		this.tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => bootstrap.Tooltip.getOrCreateInstance(tooltipTriggerEl))
	}

	/** Runs a given listener once the given event happens on the given element */
	static once(element: Element | null, event: string, listener: (event: Event) => void) {
		const handler = (args: Event) => {
			listener(args)
			element?.removeEventListener(event, handler)
		}
		element?.addEventListener(event, handler)
	}

	/** Read file as data URL and display preview */
	static fileToDataUrl(file: File | Blob): Promise<string> {
		return new Promise(resolve => {
			const reader = new FileReader()
			reader.addEventListener("load", event => resolve(event.target?.result as string))
			reader.readAsDataURL(file)
		})
	}

	/** Convert data URL to blob */
	static dataUrlToBlob(dataUrl: string): Blob | null {
		if (!dataUrl) return null
		const bytes = atob(dataUrl.split(",")[1])
		const mimeType = dataUrl.split(",")[0].split(":")[1].split(";")[0]
		const buffer = new ArrayBuffer(bytes.length)
		const uintArr = new Uint8Array(buffer)
		for (let i = 0; i < bytes.length; i++) uintArr[i] = bytes.charCodeAt(i)
		return new Blob([buffer], { type: mimeType })
	}
}


// Model inputs
export type Point2D = [x: number, y: number]
export type Point3D = [x: number, y: number, z: number]
export interface SupportPoints {
	positive: Point2D[]
	negative: Point2D[]
}
export interface SAM2Input {
	image: string,
	points: SupportPoints
}

export interface MeTRAbsInput {
	image: string
}

export interface CapeXInput {
	image: string,
	keypoints: string[],
	skeleton: [a: number, b: number][]
}

export interface Skel3DInput {
	image: string,
	skeleton: Point3D[],
	target: Point3D[]
}


// Model responses
export interface SAM2Response {
	segmentation: string,
	preview: string
}

export interface MeTRAbsResponse {
	skeleton: Point3D[],
	original: Point3D[],
	minmax: [min: number, max: number][]
}

export interface CapeXResponse {
	original: Point2D[],
	skeleton: Point3D[],
	minmax: [min: number, max: number][]
}

export interface Skel3DResponse {
	prediction: string
}

// API endpoint definitions
interface APIInputs {
	"/segmentate": SAM2Input,
	"/skeleton": MeTRAbsInput,
	"/skeleton_capex": CapeXInput,
	"/skel3d": Skel3DInput
}
interface APIOutputs {
	"/segmentate": SAM2Response,
	"/skeleton": MeTRAbsResponse,
	"/skeleton_capex": CapeXResponse,
	"/skel3d": Skel3DResponse
}

// API response types
interface APIResponse<P extends keyof APIOutputs> {
	status: number,
	json: APIOutputs[P]
}


// API class
export default class API {
	/** Whether debug mode is enabled */
	static isDebug: boolean = import.meta.env.VITE_DEBUG === "true"
	/** Base API URL */
	static apiURL: string = import.meta.env.VITE_API_URL || "http://localhost:8000"
	/** The used skeleton model */
	static skeletonModel: string = import.meta.env.VITE_SKEL_AI || "metrabs"
	private static apiKey = import.meta.env.VITE_API_KEY || "none"

	/** Fetches the requested resource */
	private static fetch<P extends keyof APIInputs>(path: P, body: APIInputs[P]): Promise<APIResponse<P> | undefined | null> {
		(path as string) = path.startsWith("/") ? path : `/${path}`
		const apiUrl = this.apiURL.replace(/\/$/, "")
		const timeoutController = new AbortController()
		setTimeout(() => timeoutController.abort(), 2 * 60 * 1000) // 2 minutes timeout
		return fetch(apiUrl + path, {
			headers: {
				"Content-Type": "application/json",
				"Authorization": `${this.apiKey}`
			},
			method: "POST", body: JSON.stringify(body),
			signal: timeoutController.signal
		}).then(async r => r.ok ? { status: r.status, json: await r.json() } : null)
		.catch(err => console.error("API fetch failed:", err) as undefined)
	}

	/**
	 * Segmentates the given image with the given support points
	 * @param image The input image as base64
	 * @param points Support points for SAM2
	 * @returns The segmentation image as base64
	 */
	public static async segmentate(image: string, points: SupportPoints): Promise<SAM2Response> {
		const resp = await this.fetch("/segmentate", { image, points })
		if (resp?.status !== 200) return { segmentation: "", preview: "" }
		return resp.json
	}

	/**
	 * Creates a 3D skeleton for the given image via MeTRAbs
	 * @param image The input image as base64
	 * @returns The detected keypoints
	 */
	public static async skeleton(image: string): Promise<MeTRAbsResponse> {
		const resp = await this.fetch("/skeleton", { image })
		if (resp?.status !== 200) return { skeleton: [], minmax: [], original: [] }
		return resp.json
	}

	/**
	 * Creates a 3D skeleton for the given image via CapeX
	 * @param image The input image as base64
	 * @param keypoints Textual description of keypoints on the image
	 * @returns The detected keypoints
	 */
	public static async skeleton_capex(image: string, keypoints: string[], skeleton: CapeXInput["skeleton"]): Promise<CapeXResponse> {
		const resp = await this.fetch("/skeleton_capex", { image, keypoints, skeleton })
		if (resp?.status !== 200) return { skeleton: [], minmax: [], original: [] }
		return resp.json
	}

	/**
	 * Creates the view of the input object from the direction specified by the given skeleton
	 * @param image The segmentated input image as base64
	 * @param skeleton The target view skeleton as base64
	 * @returns The generated view as base64
	 */
	public static async skel3D(image: string, skeleton: Point3D[], target: Point3D[]): Promise<Skel3DResponse["prediction"]> {
		const resp = await this.fetch("/skel3d", { image, skeleton, target })
		if (resp?.status !== 200) return ""
		return resp.json.prediction
	}
}