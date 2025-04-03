import { Component, ReactNode } from "react"
import API, { Utils, Point3D, Point2D, ExtrinsicMatrix } from "../api_tools"
import { AppState } from "../App"
import ToastUtils from "../toast_tools"
import { AppContext } from "../contexts/AppContextProvider"


// Component props and states
interface DemoOutputProps {
	inFile: Blob | null,
	skeleton: Point3D[] | null,
	bones: Point2D[] | null,
	srcCamera: ExtrinsicMatrix | null,
	targetCamera: ExtrinsicMatrix | null,
	loading: boolean,
	step: number,
	setLoading: (loading: boolean) => void,
	updateForwardBtn: (newState: Partial<AppState["forwardBtn"]>) => void
}

interface DemoOutputState {
	outputUrl: string
}


// Demo output class
export default class DemoOutput extends Component<DemoOutputProps, DemoOutputState> {
	// App context
	static contextType = AppContext
	declare context: React.ContextType<typeof AppContext>
	
	// Store active API call to avoid calling it multiple times
	private activeApiCall: Promise<unknown> | null = null
	
	// Constructor
	constructor(props: DemoOutputProps) {
		super(props)
		this.state = { outputUrl: "" }
	}

	// Check if both input files are ready
	private propsReady(): boolean {
		return !!(this.context.inFile && this.context.skeleton && this.context.bones && this.context.srcCamera && this.context.targetCamera)
	}

	// Query API when both input files are ready
	async componentDidUpdate(prevProps: Readonly<DemoOutputProps>): Promise<void> {
		// Ignore state changes except for input image and skeleton changes
		if (
			this.context.prevState.inFile === this.context.inFile &&
			this.context.prevState.skeleton === this.context.skeleton &&
			this.context.prevState.bones === this.context.bones &&
			this.context.prevState.srcCamera === this.context.srcCamera &&
			this.context.prevState.targetCamera === this.context.targetCamera &&
			this.context.prevState.step === this.context.step
		) return

		// Update forward button when step changes
		if (prevProps.step !== this.context.step && this.context.step === 2) {
			this.context.updateForwardBtn({ enabled: false })
		}

		// If this is the current view, update the output image
		if (this.context.step === 2) {
			// If all props are ready, make API call
			if (this.propsReady() && !this.activeApiCall) {
				if (API.isDebug) console.log("[DemoOutput] Generating target view...")
				this.context.setLoading(true)
				this.activeApiCall = API.skel3D(
					await Utils.fileToDataUrl(this.context.inFile!),
					this.context.skeleton!,
					this.context.bones!,
					this.context.srcCamera!,
					this.context.targetCamera!
				).then(output => {
					if (!output) return ToastUtils.makeToast("Failed to generate target view", "fail")
					else this.setState({ outputUrl: output })
					this.context.updateForwardBtn({ enabled: true })
					this.context.setLoading(false)
					if (API.isDebug) console.log("[DemoOutput] Target view generation successful:", !!output)
					this.activeApiCall = null
				})
			}
		}
	}
	
	// Markup
	render(): ReactNode {
		return (
			<div className="col">
				<h4 className="mb-2">Model output</h4>
				<img id="output" src={this.state.outputUrl || "/src/assets/transparent.png"} className={(this.context.loading ? "placeholder " : "") + "bordered rounded output"}></img>
			</div>
		)
	}
}