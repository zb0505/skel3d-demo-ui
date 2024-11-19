import { Component, ReactNode } from "react"
import { fileToDataUrl, updateTooltips } from "../api_tools"
import KeypointMarker from "./KeypointMarker"


// Component props and states
interface FileUploadProps {
	onFileReady: (file: File | null, keypoints: string) => void
}

interface FileUploadState {
	inputUrl: string,
	preview: string,
	kpInput: string,
	keypoints: string[]
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
			kpInput: "",
			keypoints: []
		}
	}

	// Update state
	private updateState(newState: Partial<FileUploadState>) {
		this.stateCopy = { ...this.stateCopy, ...newState }
		this.setState(this.stateCopy)
	}

	// Component rendered event
	componentDidMount(): void {
		// Update tooltips
		updateTooltips()
		
		// Listen to file upload events
		const input = document.querySelector("input#input") as HTMLInputElement
		input.addEventListener("change", async () => {
			if (!input.files?.length) return this.updateState({ inputUrl: "" })

			// Read file as data URL and display preview
			this.updateState({ inputUrl: await fileToDataUrl(input.files[0]) })
		})
	}

	// Add new keypoint
	private addKeypoint() {
		const keypoints = this.stateCopy.keypoints
		keypoints.push(this.state.kpInput)
		this.updateState({ keypoints, kpInput: "" })
	}

	// Change keypoint description
	private changeKeypoint(idx: number, value: string) {
		const keypoints = this.stateCopy.keypoints
		keypoints[idx] = value
		this.updateState({ keypoints })
	}

	// Remove keypoint by index
	private removeKeypoint(index: number) {
		const keypoints = this.stateCopy.keypoints
		keypoints.splice(index, 1)
		this.updateState({ keypoints })
	}

	// Markup
	render(): ReactNode {
		return (
			<div className="d-flex flex-column flex-lg-row justify-content-between">
				<div className="flex-fill">
					<h4 className="form-label m-0 mb-2">Input image</h4>
					<div className="input-container">
						<input className="form-control mb-3" type="file" id="input" accept="image/jpeg, image/png" />
						<KeypointMarker currentImage={this.state.inputUrl} onPreviewUpdated={preview => this.updateState({ preview })}>
							<img id="preview" className="preview" src={this.state.preview || this.state.inputUrl || "/src/assets/transparent.png"} />
						</KeypointMarker>
					</div>
				</div>
				<div className="flex-fill ms-2 mw-50">
					<h5 className="form-label m-0 my-2">Keypoints</h5>
					<div className="table-responsive keypoints">
						<table className="table table-striped">
							<thead>
								<tr>
									<th className="text-start">
										<input className="form-control" placeholder="Keypoint" value={this.state.kpInput} onChange={e => this.updateState({ kpInput: e.target.value })} />
									</th>
									<th className="text-center">
										<button className="btn btn-outline-success" onClick={this.addKeypoint.bind(this)}><i className="fa-solid fa-plus"></i></button>
									</th>
								</tr>
							</thead>
							<tbody>
								{ this.state.keypoints.map((kp, i) =>
									<tr key={i}>
										<td className="text-start">
											<input className="form-control" value={kp} onChange={e => this.changeKeypoint(i, e.target.value)} />
										</td>
										<td className="text-center">
											<button className="btn btn-ghost text-danger" onClick={() => this.removeKeypoint(i)}><i className="fa-solid fa-circle-xmark"></i></button>
										</td>
									</tr>
								) }
							</tbody>
						</table>
					</div>
				</div>
			</div>
		)
	}
}