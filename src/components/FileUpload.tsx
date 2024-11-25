import { Component, ReactNode } from "react"
import { fileToDataUrl, updateTooltips } from "../api_tools"
import KeypointMarker from "./KeypointMarker"
import { AppState } from "../App"


// Component props and states
interface FileUploadProps {
	step: number,
	reset: boolean,
	onFileReady: (file: File | null, keypoints: string) => void,
	updateForwardBtn: (newState: Partial<AppState["forwardBtn"]>) => void
}

interface FileUploadState {
	inputUrl: string,
	preview: string,
	keypoints: string
}


// File upload class
export default class FileUpload extends Component<FileUploadProps, FileUploadState> {
	private stateCopy: FileUploadState
	
	// Constructor
	constructor(props: FileUploadProps) {
		super(props)
		this.state = this.stateCopy = {
			inputUrl: "",
			preview: "",
			keypoints: ""
		}
	}

	// Update state
	private updateState(newState: Partial<FileUploadState>) {
		this.stateCopy = { ...this.stateCopy, ...newState }
		this.setState(this.stateCopy)

		// Update forward button state
		this.props.updateForwardBtn({
			enabled: !!(this.stateCopy.inputUrl && this.stateCopy.preview && this.stateCopy.keypoints)
		})
	}

	// Component rendered event
	componentDidMount(): void {
		// Update tooltips
		updateTooltips()

		// Update forward button
		this.props.updateForwardBtn({
			text: "Next",
			enabled: false
		})
		
		// Listen to file upload events
		const input = document.querySelector("#inputImg") as HTMLInputElement
		input.addEventListener("change", async () => {
			if (!input.files?.length) return this.updateState({ inputUrl: "" })

			// Read file as data URL and display preview
			this.updateState({ inputUrl: await fileToDataUrl(input.files[0]) })
		})
	}

	// Component updated event
	componentDidUpdate(prevProps: Readonly<FileUploadProps>, _prevState: Readonly<FileUploadState>, _snapshot?: any): void {
		// Ignore all changes except for reset and step props
		if (prevProps.reset === this.props.reset && prevProps.step === this.props.step) return

		// Handle resetting data
		if (this.props.reset) {
			(document.querySelector("#inputImg") as HTMLInputElement).value = ""
			this.updateState({
				inputUrl: "",
				preview: "",
				keypoints: ""
			})
		}

		// Handle step change
		else if (this.props.step === 0) {
			this.props.updateForwardBtn({
				text: "Next",
				enabled: !!(this.stateCopy.inputUrl && this.stateCopy.preview && this.stateCopy.keypoints)
			})
		}
	}

	// Markup
	render(): ReactNode {
		return (
			<div className="d-flex flex-column flex-lg-row justify-content-between">
				<div className="flex-fill">
					<h4 className="form-label m-0 mb-2">Input image</h4>
					<div className="input-container">
						<input className="form-control mb-3" type="file" id="inputImg" accept="image/jpeg, image/png" />
						<KeypointMarker currentImage={this.state.inputUrl} onPreviewUpdated={preview => this.updateState({ preview })}>
							<img id="preview" className="preview" src={this.state.preview || this.state.inputUrl || "/src/assets/transparent.png"} />
						</KeypointMarker>
					</div>
				</div>
				<div className="flex-fill ms-5 mw-50">
					<h5 className="form-label m-0 my-2">Keypoints</h5>
					<p className="mb-2 text-start">List all keypoints separated via commas as in the placeholder.</p>
					<textarea className="form-control mb-2" rows={10} style={{ resize: "none" }}
						value={this.state.keypoints} onChange={e => this.updateState({ keypoints: e.target.value })}
						placeholder="head, body, left elbow, left hand, right elbow, right hand, hips, left knee, left foot, right knee, right foot" />
					<button className="btn btn-primary" onClick={() => this.updateState({ keypoints: document.querySelector("textarea")?.placeholder || "" })}>Use placeholder</button>
				</div>
			</div>
		)
	}
}