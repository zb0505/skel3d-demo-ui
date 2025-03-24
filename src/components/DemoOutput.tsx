import { Component, ReactNode } from "react"
import API, { Utils, Point3D } from "../api_tools"
import { AppState } from "../App"
import ToastUtils from "../toast_tools"


// Component props and states
interface DemoOutputProps {
	inFile: Blob | null,
	currSkel: Point3D[] | null,
	targetSkel: Point3D[] | null,
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
	// Store active API call to avoid calling it multiple times
	private activeApiCall: Promise<unknown> | null = null
	
	// Constructor
	constructor(props: DemoOutputProps) {
		super(props)
		this.state = { outputUrl: "" }
	}

	// Check if both input files are ready
	private propsReady(): boolean {
		return !!(this.props.inFile && this.props.currSkel && this.props.targetSkel)
	}

	// Query API when both input files are ready
	async componentDidUpdate(prevProps: Readonly<DemoOutputProps>): Promise<void> {
		// Ignore state changes except for input image and skeleton changes
		if (
			prevProps.inFile === this.props.inFile &&
			prevProps.currSkel === this.props.currSkel &&
			prevProps.targetSkel === this.props.targetSkel &&
			prevProps.step === this.props.step
		) return

		// Update forward button when step changes
		if (prevProps.step !== this.props.step && this.props.step === 2) {
			this.props.updateForwardBtn({ enabled: false })
		}

		// If this is the current view, update the output image
		if (this.props.step === 2) {
			// If all props are ready, make API call
			if (this.propsReady() && !this.activeApiCall) {
				console.log("[DemoOutput] Generating target view...")
				this.props.setLoading(true)
				this.activeApiCall = API.skel3D(await Utils.fileToDataUrl(this.props.inFile!), this.props.currSkel!, this.props.targetSkel!).then(output => {
					if (!output) return ToastUtils.makeToast("Failed to generate target view", "fail")
					else this.setState({ outputUrl: output })
					this.props.updateForwardBtn({ enabled: true })
					this.props.setLoading(false)
					console.log("[DemoOutput] Target view generation successful:", !!output)
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
				<img id="output" src={this.state.outputUrl || "/src/assets/transparent.png"} className={(this.props.loading ? "placeholder " : "") + "bordered rounded output"}></img>
			</div>
		)
	}
}