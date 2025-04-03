import { Component, ReactNode } from "react"
import API, { Utils } from "../api_tools"
import KeypointMarker from "./KeypointMarker"
import Modal from "./Modal"
import ToastUtils from "../toast_tools"
import { AppContext } from "../contexts/AppContextProvider"


// Component states
interface FileUploadState {
	inputUrl: string,
	preview: string,
	exampleShown: boolean
}


// File upload class
export default class FileUpload extends Component<unknown, FileUploadState> {
	// App context
	static contextType = AppContext
	declare context: React.ContextType<typeof AppContext>
	
	// Fields
	private stateCopy: FileUploadState
	private fileInput: HTMLInputElement | null = null
	private readonly kpExample = "head\nbody\n- left elbow\n-- left hand\n- right elbow\n-- right hand\nhips\n- left knee\n-- left foot\n- right knee\n-- right foot"
	
	// Constructor
	constructor(props: unknown) {
		super(props)
		this.state = this.stateCopy = {
			inputUrl: "",
			preview: "",
			exampleShown: false
		}
	}

	// Update state
	private updateState(newState: Partial<FileUploadState>): void {
		this.stateCopy = { ...this.stateCopy, ...newState }
		this.setState(this.stateCopy)

		// Update forward button state
		this.context.updateForwardBtn({
			enabled: !!(this.stateCopy.inputUrl && this.stateCopy.preview && this.context.updatedState.keypoints)
		})
	}

	// Component rendered event
	componentDidMount(): void {
		// Update tooltips
		Utils.updateTooltips()

		// Update forward button
		this.context.updateForwardBtn({
			text: "Next",
			enabled: false
		})
		
		// Listen to file upload events
		const input = this.fileInput ??= document.querySelector("#inputImg") as HTMLInputElement // Ensure input is not null
		input.addEventListener("change", async () => {
			// If there are no files, set the input URL to empty
			if (!input.files?.length) return this.updateState({ inputUrl: "" })

			// If the file type is incorrect, show a toast and reset the input
			const fileType = input.files[0].type
			if (this.fileInput && !this.fileInput.accept.split(",").some(type => fileType === type.trim())) {
				ToastUtils.makeToast("Invalid file type", "fail")
				this.fileInput.value = ""
				return this.updateState({ inputUrl: "" })
			}

			// Read file as data URL and display preview
			this.updateState({ inputUrl: await Utils.fileToDataUrl(input.files[0]) })
		})
	}

	// Component updated event
	componentDidUpdate(_prevProps: Readonly<unknown>, prevState: Readonly<FileUploadState>): void {
		// Ignore all changes except for reset and step props and preview state
		if (
			this.context.prevState.reset === this.context.reset &&
			this.context.prevState.step === this.context.step &&
			prevState.preview === this.state.preview
		) return

		// Handle resetting data
		if (this.context.reset) {
			if (this.fileInput) this.fileInput.value = ""
			this.updateState({
				inputUrl: "",
				preview: "",
			})
			this.context.updateState({ keypoints: "" })
		}

		// Handle step change
		else if (this.context.step === 0) {
			const forwardEnabled = !!(this.stateCopy.inputUrl && this.stateCopy.preview && (API.skeletonModel !== "capex" || this.context.updatedState.keypoints))
			this.context.updateForwardBtn({
				text: "Next",
				enabled: forwardEnabled
			})
		}

		// Handle preview update
		if (prevState.preview !== this.state.preview) {
			this.context.updateState({ inFile: Utils.dataUrlToBlob(this.state.inputUrl), reset: false })
		}
	}

	// Markup
	render(): ReactNode {
		// Modal body markup
		const modalBody = (<>
			<p className="text-start m-0">
				The skeleton is rendered based on the defined hierarchy.<br />
				Hierarchy definition rules:
			</p>
			<ul className="text-start">
				<li>top-level keypoints are connected in the given order</li>
				<li>indented keypoints are connected to the previous level</li>
			</ul>
			<p className="text-start">Below is the keypoint hierarchy of the example:</p>
			<div className="d-flex flex-row">
				<pre className="w-50 m-0 p-2 text-start border rounded-start">{this.kpExample}</pre>
				<img className="w-50 border rounded-end" src="/src/assets/keypoints_example.png" />
			</div>
		</>)
		
		// Component markup
		return (<>
			<Modal id="exampleModal" shown={this.state.exampleShown} setShown={s => this.updateState({ exampleShown: s })}
				title="Example keypoints" body={modalBody} />
			<div className="d-flex flex-column flex-lg-row justify-content-between">
				<div className="flex-fill mw-50">
					<h4 className="form-label m-0 mb-2">Input image</h4>
					<div className="input-container">
						<input className="form-control mb-3" type="file" id="inputImg"
							accept="image/jpeg, image/png" ref={input => this.fileInput = input} />
						<KeypointMarker currentImage={this.state.inputUrl} onPreviewUpdated={preview => this.updateState({ preview })}>
							<img id="preview" className="preview" src={this.state.preview || this.state.inputUrl || "/src/assets/transparent.png"} />
						</KeypointMarker>
					</div>
				</div>
				<div className="mw-45 ms-0 ms-lg-5 mt-3 mt-lg-0" hidden={API.skeletonModel !== "capex"}>
					<h5 className="form-label m-0 my-2">Keypoints</h5>
					<p className="mb-2 text-start">
						List all keypoints in order and adjust connections with the number of dashes.
						Click the button below to see the example.
					</p>
					<textarea className="form-control mb-2" rows={10} style={{ resize: "none" }}
						value={this.context.keypoints} onChange={e => this.context.updateState({ keypoints: e.target.value })}
						placeholder="head, body, left elbow, left hand, right elbow, right hand, hips, left knee, left foot, right knee, right foot" />
					<button className="btn btn-outline-primary me-2" onClick={() => this.context.updateState({ keypoints: this.kpExample })}>Use example</button>
					<button className="btn btn-outline-secondary" onClick={() => this.updateState({ exampleShown: true })}>Check example skeleton</button>
				</div>
			</div>
		</>)
	}
}