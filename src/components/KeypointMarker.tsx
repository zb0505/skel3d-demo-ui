import React, { Component, ReactNode } from "react"
import API, { Point } from "../api_tools"
import makeToast from "../toast_tools"


// Component props and states
interface KeypointMarkerProps {
	children: React.JSX.Element,
	currentImage: string,
	onPreviewUpdated: (image: string) => void
}

interface KeypointMarkerStates {
	markerType: "pos" | "neg"
}


// Keypoint marker class
export default class KeypointMarker extends Component<KeypointMarkerProps, KeypointMarkerStates> {
	// Fields
	private markerTimeout: ReturnType<typeof setTimeout> | null = null
	private activeApiCall: Promise<any> | null = null
	private container: HTMLDivElement | null = null
	private image: HTMLImageElement | null = null
	private positive: Point[] = []
	private negative: Point[] = []
	
	// Constructor
	constructor(props: KeypointMarkerProps) {
		super(props)
		this.state = { markerType: "pos" }
	}

	// Get image true position relative to the viewport
	private getImagePosition(image: HTMLImageElement) {
		const box = image.getBoundingClientRect()
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

	// Validate point location
	private validatePoint(point: number[], image: HTMLImageElement): boolean {
		const box = this.getImagePosition(image)
		const imgLeft = box.left, imgRight = box.right
		const imgTop = box.top, imgBottom = box.bottom
		console.log("[KeypointMarker] Image props:",
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

	// New point added
	private onPointAdded() {
		if (this.activeApiCall) return
		if (this.markerTimeout) clearTimeout(this.markerTimeout)
		console.log("[KeypointMarker] Point added, waiting for timeout")
		this.markerTimeout = setTimeout(() => {
			console.log("[KeypointMarker] Timeout reached, running segmentation")
			this.image?.classList.add("placeholder")
			this.activeApiCall = API.segmentate(this.props.currentImage, { positive: this.positive, negative: this.negative })
			.then(output => {
				console.log("[KeypointMarker] Output length:", output.length)
				this.props.onPreviewUpdated(output)
				if (!output) makeToast("Failed to create segmentation", "fail")
				else makeToast("Segmentation successful", "success")
				console.log("[KeypointMarker] Segmentation complete")
				this.image?.classList.remove("placeholder")
				this.activeApiCall = null
			})
		}, 2000)
		
	}

	// Reset points
	private async removePoints(): Promise<void> {
		if (this.container) this.container.innerHTML = ""
		if (this.activeApiCall) return this.activeApiCall.then(() => this.removePoints())
		this.props.onPreviewUpdated("")
		this.positive = []
		this.negative = []
	}

	// Component rendered event
	componentDidMount(): void {
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
			const box = this.getImagePosition(image)
			const scaleX = image.naturalWidth / image.offsetWidth, scaleY = image.naturalHeight / image.offsetHeight
			const coords = [(event.x - box.left) * scaleX, (event.y - box.top) * scaleY].map(Math.round) as Point
			console.log("[KeypointMarker] Image info:",
				`\n  Size: ${image.offsetWidth}x${image.offsetHeight}`,
				`\n  Offset: ${box.left}x${box.top}`,
				`\n  Original: ${image.naturalWidth}x${image.naturalHeight}`,
				`\n  Scale: ${scaleX} x ${scaleY}`,
				`\n  Event coords: ${event.x}x${event.y}`,
				`\n  Coords:`, [event.x - box.left, event.y - box.top],
				`\n  Scaled coords:`, coords
			)
			// If the point is already in the list, ignore it
			if ([...this.positive, ...this.negative].some(p => p[0] === coords[0] && p[1] === coords[1])) return
			// Otherwise add the point
			if (this.state.markerType === "pos") this.positive.push(coords)
			else this.negative.push(coords)

			// Create point on view
			const point = document.createElement("span")
			point.classList.add("point", this.state.markerType)
			point.style.top = `${event.clientY - 5}px`
			point.style.left = `${event.clientX - 5}px`
			container.appendChild(point)
			this.onPointAdded()
		})
	}

	// File change listener
	componentDidUpdate(prevProps: Readonly<KeypointMarkerProps>, _prevState: Readonly<KeypointMarkerStates>, _snapshot?: any): void {
		// Re-render triggered, re-select container
		this.container = document.querySelector("div.kp-marker .container")
		
		// Ignore if anything changes besides the selected image
		if (prevProps.currentImage === this.props.currentImage) return

		// New image selected, remove keypoints
		this.removePoints()
	}

	// Markup
	render(): ReactNode {
		return (<>
			<div className="kp-marker placeholder-glow">
				{this.props.children}
				<div className="container"></div>
			</div>
			<div className="mt-2">
				<button className={"btn btn-outline-success me-2" + (this.state.markerType === "pos" ? " active" : "")} onClick={() => this.setState({ markerType: "pos" })}>
					<i className="fa-solid fa-plus"></i>
				</button>
				<button className={"btn btn-outline-danger me-2" + (this.state.markerType === "neg" ? " active" : "")} onClick={() => this.setState({ markerType: "neg" })}>
					<i className="fa-solid fa-minus"></i>
				</button>
				<button className="btn btn-ghost text-danger" onClick={() => this.removePoints()}>
					<i className="fa-solid fa-trash"></i>
				</button>
			</div>
		</>)
	}
}