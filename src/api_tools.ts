// Imports
import * as bootstrap from "bootstrap"


/** Collection of utility functions */
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


// #region Common types
export type Point2D = [x: number, y: number]
export type Point3D = [x: number, y: number, z: number]
export type BoundingBox = [left: number, top: number, width: number, height: number]
export type ExtrinsicMatrix = [
	// Right (X-axis) + Translation
    [...Point3D, translationX: number],
	// Up (Y-axis) + Translation
    [...Point3D, translationY: number],
	// Forward (Z-axis) + Translation
    [...Point3D, translationZ: number],
	// Homogeneous row
	[number, number, number, number]
]
// #endregion


// #region Model inputs
/** Support points for SAM2 */
export interface SupportPoints {
	/** Positive support points */
	positive: Point2D[]
	/** Negative support points */
	negative: Point2D[]
}

/** SAM2 model input */
export interface SAM2Input {
	/** Image to segmentate */
	image: string,
	/** Support points for SAM2 */
	points: SupportPoints
}

/** MeTRAbs model input */
export interface MeTRAbsInput {
	/** Image to generate the skeleton for */
	image: string,
	/** Bounding box of the object on the image (for more precise output) */
	bbox?: BoundingBox | null
}

/** CapeX model input */
export interface CapeXInput {
	/** Image to generate the skeleton for */
	image: string,
	/** List of textual description of keypoints */
	keypoints: string[],
	/** Bones between the keypoints */
	skeleton: Point2D[]
}

/** Skel3D model input */
export interface Skel3DInput {
	/** Segmentated image of the object to generate the rotated view for */
	image: string,
	/** 3D joints of the skeleton */
	joints: Point3D[],
	/** Bones of the skeleton (between joints) */
	bones: Point2D[],
	/** Camera extrinsic matrix of the input image (origin) */
	src_camera: ExtrinsicMatrix,
	/** Camera extrinsic matrix of the target view (rotation target) */
	target_camera: ExtrinsicMatrix
}
// #endregion


// #region Model responses
/** SAM2 model output */
export interface SAM2Response {
	/** The segmentation image with transparent background */
	segmentation: string | null,
	/** The preview image with grayscale and transparency effects applied to the background */
	preview: string | null,
	/** The bounding box of the object on the image */
	bbox: BoundingBox | null
}

/** MeTRAbs model output */
export interface MeTRAbsResponse {
	/** The bones between the skeleton joints */
	bones: Point2D[] | null,
	/** The generated skeleton joints optimized for UI display */
	skeleton: Point3D[] | null,
	/** The original skeleton joints without transformations */
	original: Point3D[] | null,
	/** Minimum and maximum values for each dimension of the output */
	minmax: [min: number, max: number][] | null
}

/** CapeX model output */
export interface CapeXResponse {
	/** The original skeleton joints without transformations */
	original: Point2D[] | null,
	/** The generated skeleton joints optimized for UI display */
	skeleton: Point3D[] | null,
	/** Minimum and maximum values for each dimension of the output */
	minmax: [min: number, max: number][] | null
}

/** Skel3D model output */
export interface Skel3DResponse {
	/** The generated views */
	predictions: string[] | null
}
// #endregion


// #region API endpoint definitions and response types
/** API input types for each endpoint */
interface APIInputs {
	"/segmentate": SAM2Input,
	"/skeleton": MeTRAbsInput,
	"/skeleton_capex": CapeXInput,
	"/skel3d": Skel3DInput
}

/** API output types for each endpoint */
interface APIOutputs {
	"/segmentate": SAM2Response,
	"/skeleton": MeTRAbsResponse,
	"/skeleton_capex": CapeXResponse,
	"/skel3d": Skel3DResponse
}

/** API response type */
interface APIResponse<P extends keyof APIOutputs> {
	/** HTTP status code */
	status: number,
	/** Parsed JSON response */
	json: APIOutputs[P]
}
// #endregion


/** Collection of API query functions and environment variables */
export default class API {
	/** Whether debug mode is enabled */
	static isDebug: boolean = import.meta.env.VITE_DEBUG === "true"
	/** Base API URL */
	static apiURL: string = import.meta.env.VITE_API_URL || "http://localhost:8000"
	/** The used skeleton model */
	static skeletonModel: string = import.meta.env.VITE_SKEL_AI || "metrabs"
	/** The API key to use */
	private static apiKey = import.meta.env.VITE_API_KEY || "none"

	/** Fetches the requested resource */
	private static async fetch<P extends keyof APIInputs>(path: P, body: APIInputs[P]): Promise<APIResponse<P> | undefined | null> {
		(path as string) = path.startsWith("/") ? path : `/${path}`
		const apiUrl = this.apiURL.replace(/\/$/, "")
		const timeoutController = new AbortController()
		setTimeout(() => timeoutController.abort(), 60 * 1000) // 1 minute timeout
		try {
			const r = await fetch(apiUrl + path, {
				headers: {
					"Content-Type": "application/json",
					"Authorization": `${this.apiKey}`
				},
				method: "POST", body: JSON.stringify(body),
				signal: timeoutController.signal
			})
			return r.ok ? { status: r.status, json: await r.json() } : null
		} catch (err) {
			return console.error("API fetch failed:", err) as undefined
		}
	}

	/**
	 * Segmentates the given image with the given support points
	 * @param image The input image as base64
	 * @param points Support points for SAM2
	 * @returns The segmentation image as base64
	 */
	public static async segmentate(image: string, points: SupportPoints): Promise<SAM2Response> {
		const resp = await this.fetch("/segmentate", { image, points })
		if (resp?.status !== 200) return { segmentation: "", preview: "", bbox: null }
		return resp.json
	}

	/**
	 * Creates a 3D skeleton for the given image via MeTRAbs
	 * @param image The input image as base64
	 * @param bbox The bounding box of the object on the image
	 * @returns The detected keypoints
	 */
	public static async skeleton(image: string, bbox?: BoundingBox | null): Promise<MeTRAbsResponse> {
		const resp = await this.fetch("/skeleton", { image, bbox })
		if (resp?.status !== 200) return { skeleton: [], original: [], minmax: [], bones: [] }
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
	 * @param joints The 3D joints of the skeleton
	 * @param bones The bones of the skeleton
	 * @param srcCamera The camera extrinsic matrix of the input image
	 * @param targetCamera The camera extrinsic matrix of the target view
	 * @returns The generated view as base64
	 */
	public static async skel3D(
		image: string, joints: Point3D[], bones: Point2D[],
		srcCamera: ExtrinsicMatrix, targetCamera: ExtrinsicMatrix
	): Promise<Skel3DResponse["predictions"]> {
		const resp = await this.fetch("/skel3d", { image, joints, bones, src_camera: srcCamera, target_camera: targetCamera })
		if (resp?.status !== 200) return []
		return resp.json.predictions
	}
}