import React, { Component, ReactNode } from "react"
import API, { Point2D, Utils } from "../api_tools"
import ToastUtils from "../toast_tools"
import { AppContext } from "../contexts/AppContextProvider"


// Component props and states
interface KeypointMarkerProps {
	children: React.JSX.Element,
	currentImage: string,
	reset: boolean,
	onPreviewUpdated: (image: string) => void
}

interface KeypointMarkerStates {
	markerType: "pos" | "neg"
}

export interface Position {
	width: number,
	height: number,
	left: number,
	top: number,
	right: number,
	bottom: number,
	x: number,
	y: number
}


// Keypoint marker class
export default class KeypointMarker extends Component<KeypointMarkerProps, KeypointMarkerStates> {
	// #region Fields
	// App context
	static contextType = AppContext
	declare context: React.ContextType<typeof AppContext>
	
	/** Segmentation API call timeout */
	private markerTimeout: ReturnType<typeof setTimeout> | null = null
	
	/** Currently active API call */
	private activeApiCall: Promise<unknown> | null = null
	
	/** Marker container */
	private container: HTMLDivElement | null = null
	
	/** Image element */
	private image: HTMLImageElement | null = null
	
	/** Points on the image (including their HTML elements) */
	private points: [...Point2D, HTMLSpanElement][] = []

	/** Points on the image that have already been segmentated (including their HTML elements) */
	private processedPoints: [...Point2D, HTMLSpanElement][] = []
	
	/** Positive points */
	private positive: Point2D[] = []
	
	/** Negative points */
	private negative: Point2D[] = []
	// #endregion
	
	// #region Constructor
	/** Component constructor */
	constructor(props: KeypointMarkerProps) {
		super(props)
		this.state = { markerType: "pos" }
	}
	// #endregion
	
	// #region Methods
	/** Gets element position relative to the viewport */
	private getElemPosition(element: HTMLElement): Position {
		const box = element.getBoundingClientRect()
		return {
			width: Math.round(box.width),
			height: Math.round(box.height),
			left: Math.round(box.left),
			top: Math.round(box.top),
			right: Math.round(box.right),
			bottom: Math.round(box.bottom),
			x: Math.round(box.x),
			y: Math.round(box.y)
		}
	}

	/** Validates the location of the given point based on the position of the given image element */
	private validatePoint(point: number[], image: HTMLImageElement): boolean {
		const box = this.getElemPosition(image)
		const imgLeft = box.left, imgRight = box.right
		const imgTop = box.top, imgBottom = box.bottom
		if (API.isDebug) console.log("[KeypointMarker] Image props:",
			`\n  HTML size: ${image.offsetWidth}x${image.offsetHeight}`,
			`\n  Orig size: ${image.naturalWidth}x${image.naturalHeight}`,
			"\n  Position:",
			"\n    Left:", imgLeft,
			"\n    Right:", imgRight,
			"\n    Top:", imgTop,
			"\n    Bottom:", imgBottom,
			"\n  Point:", point,
		)
		return imgLeft <= point[0] && imgRight >= point[0] && imgTop <= point[1] && imgBottom >= point[1]
	}

	/** New point added callback */
	private onPointAdded(): void {
		if (this.activeApiCall) return
		if (this.markerTimeout) clearTimeout(this.markerTimeout)
		if (API.isDebug) console.log("[KeypointMarker] Point added, waiting for timeout")
		this.markerTimeout = setTimeout(() => {
			if (API.isDebug) console.log("[KeypointMarker] Timeout reached, running segmentation")
			this.image?.classList.add("placeholder")
			this.activeApiCall = API.segmentate(this.props.currentImage, { positive: this.positive, negative: this.negative })
			.then(resp => {
				if (API.isDebug) console.log("[KeypointMarker] Response:", resp)
				const { preview, bbox, segmentation } = resp
				if (API.isDebug) console.log("[KeypointMarker] Output length:", preview?.length)
				if (!preview) {
					ToastUtils.makeToast("Failed to create segmentation", "fail")
					this.checkUnsegmentedPoints()
				}
				else {
					this.props.onPreviewUpdated(preview || "")
					this.context.updateState({ bbox, segmentation })
					this.processedPoints = [...this.points]
				}
				if (API.isDebug) console.log("[KeypointMarker] Segmentation complete")
				this.image?.classList.remove("placeholder")
				this.activeApiCall = null
			})
		}, 2000)
	}

	/** Checks points that couldn't be segmentated or removed */
	private checkUnsegmentedPoints(): void {
		if (this.points.length < 1) return
		const unsegmented = this.points.filter(p => !this.processedPoints.some(q => p[0] === q[0] && p[1] === q[1]))
		unsegmented.forEach(point => {
			this.points.splice(this.points.indexOf(point), 1)
			this.positive = this.positive.filter(p => p[0] !== point[0] && p[1] !== point[1])
			this.negative = this.negative.filter(p => p[0] !== point[0] && p[1] !== point[1])
			point[2].remove()
		})
		const missing = this.processedPoints.filter(p => !this.points.some(q => p[0] === q[0] && p[1] === q[1]))
		missing.forEach(point => this.container?.appendChild(point[2]))
		this.points = [...this.processedPoints]
	}

	/** Removes the latest point and runs segmentation again (unless defined otherwise) */
	private async undoLastPoint(): Promise<void> {
		if (this.points.length < 1) return
		if (this.activeApiCall) return this.activeApiCall.then(() => this.undoLastPoint())
		if (this.markerTimeout) clearTimeout(this.markerTimeout)
		if (API.isDebug) console.log("[KeypointMarker] Undo last point")
		const lastPoint = this.points.pop()!
		this.positive = this.positive.filter(p => p[0] !== lastPoint[0] && p[1] !== lastPoint[1])
		this.negative = this.negative.filter(p => p[0] !== lastPoint[0] && p[1] !== lastPoint[1])
		lastPoint[2].remove()
		// If there are no points left, reset state
		if (this.points.length < 1) this.removePoints()
		// Otherwise run segmentation
		else this.onPointAdded()
	}

	/** Removes all points */
	private async removePoints(): Promise<void> {
		if (this.activeApiCall) return this.activeApiCall.then(() => this.removePoints())
		if (this.container) this.container.querySelectorAll(".point").forEach(p => p.remove())
		this.props.onPreviewUpdated("")
		this.context.updateState({ segmentation: null, bbox: null })
		this.points = []
		this.positive = []
		this.negative = []
	}

	/** Component mounted (rendered) callback */
	componentDidMount(): void {
		// Update tooltips
		Utils.updateTooltips()
		
		// Containers and image
		const marker = document.querySelector("div.kp-marker") as HTMLDivElement
		const container = this.container = marker.querySelector(".container") as HTMLDivElement
		const image = this.image = document.querySelector("#preview") as HTMLImageElement

		// Add listener to marker container
		marker.addEventListener("click", event => {
			// Check if an input image has been selected
			if (!this.props.currentImage) return
			
			// Check if point location is valid
			if (!this.validatePoint([event.x, event.y], image)) return

			// Check if there's an active API query
			if (this.activeApiCall) return

			// Add point to list
			const imgBox = this.getElemPosition(image)
			const contBox = this.getElemPosition(container)
			const scaleX = image.naturalWidth / image.offsetWidth, scaleY = image.naturalHeight / image.offsetHeight
			const coords = [(event.x - imgBox.left) * scaleX, (event.y - imgBox.top) * scaleY].map(Math.round) as Point2D
			if (API.isDebug) console.log("[KeypointMarker] Image info:",
				`\n  Size: ${image.offsetWidth}x${image.offsetHeight}`,
				`\n  Offset: ${imgBox.left}x${imgBox.top}`,
				`\n  Original: ${image.naturalWidth}x${image.naturalHeight}`,
				`\n  Scale: ${scaleX} x ${scaleY}`,
				`\n  Event coords: ${event.x}x${event.y}`,
				`\n  Coords:`, [event.x - imgBox.left, event.y - imgBox.top],
				`\n  ImgBox:`, imgBox,
				`\n  ContBox:`, contBox,
				`\n  Scaled coords:`, coords
			)
			// If the point is already in the list, ignore it
			if ([...this.positive, ...this.negative].some(p => p[0] === coords[0] && p[1] === coords[1])) return
			// Otherwise add the point
			if (this.state.markerType === "pos") this.positive.push(coords)
			else this.negative.push(coords)

			// Calculate point relative position via percentage
			const relX = Math.round((event.x - contBox.left - 5) / contBox.width * 100)
			const relY = Math.round((event.y - contBox.top - 5) / contBox.height * 100)

			// Create point on view
			const point = document.createElement("span")
			point.classList.add("point", this.state.markerType)
			point.style.top = `${relY}%`
			point.style.left = `${relX}%`
			container.appendChild(point)
			this.points.push([...coords, point])
			this.onPointAdded()
		})
	}

	/** Context and props update callback */
	componentDidUpdate(prevProps: Readonly<KeypointMarkerProps>): void {
		// Re-render triggered, re-select container
		this.container = document.querySelector("div.kp-marker .container")

		// Handle resetting data
		if (this.props.reset) {
			this.removePoints()
			this.setState({ markerType: "pos" })
		}
		
		// Ignore if anything changes besides the selected image
		if (prevProps.currentImage === this.props.currentImage) return

		// New image selected, remove keypoints
		this.removePoints()
	}

	/** Component render method */
	render(): ReactNode {
		return (<>
			<div className="kp-marker placeholder-glow">
				<div className="container">
					{this.props.children}
				</div>
			</div>
			<div className="mt-2">
				<button className={"btn btn-outline-success me-2" + (this.state.markerType === "pos" ? " active" : "")}
					data-bs-toggle="tooltip" data-bs-title="Positive point marker"
					disabled={!this.props.currentImage}
					onClick={() => this.setState({ markerType: "pos" })}>
					<i className="fa-solid fa-plus"></i>
				</button>
				<button className={"btn btn-outline-danger me-2" + (this.state.markerType === "neg" ? " active" : "")}
					data-bs-toggle="tooltip" data-bs-title="Negative point marker"
					disabled={!this.props.currentImage}
					onClick={() => this.setState({ markerType: "neg" })}>
					<i className="fa-solid fa-minus"></i>
				</button>
				<button className="btn btn-ghost text-secondary" onClick={() => this.undoLastPoint()}
					data-bs-toggle="tooltip" data-bs-title="Undo last point"
					disabled={!this.props.currentImage}>
					<i className="fa-solid fa-undo"></i>
				</button>
				<button className="btn btn-ghost text-danger" onClick={() => this.removePoints()}
					data-bs-toggle="tooltip" data-bs-title="Delete points"
					disabled={!this.props.currentImage}>
					<i className="fa-solid fa-trash"></i>
				</button>
			</div>
		</>)
	}
	// #endregion
}