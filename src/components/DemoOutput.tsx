import { Component, ReactNode } from "react"
import API from "../api_tools"
import ToastUtils from "../toast_tools"
import { AppContext } from "../contexts/AppContextProvider"
import * as bootstrap from "bootstrap"


// Component states
interface DemoOutputState {
	outputUrls: string[]
}


/** Component for showing model output images */
export default class DemoOutput extends Component<unknown, DemoOutputState> {
	// #region Fields
	// App context
	static contextType = AppContext
	declare context: React.ContextType<typeof AppContext>
	
	/** Currently active API call */
	private activeApiCall: Promise<unknown> | null = null
	// #endregion
	
	// #region Constructor
	/** Component constructor */
	constructor(props: unknown) {
		super(props)
		this.state = { outputUrls: [] }
	}
	// #endregion

	// #region Methods
	/** Checks if all input properties are ready */
	private propsReady(): boolean {
		return !!(this.context.inFile && this.context.skeleton && this.context.bones && this.context.srcCamera && this.context.targetCamera)
	}

	/** Starts view generation API call */
	private generateViews(): void {
		if (this.activeApiCall) return
		if (API.isDebug) console.log("[DemoOutput] Generating target view...")
		this.context.setLoading(true)
		this.activeApiCall = API.skel3D(
			this.context.segmentation!,
			this.context.skeleton!,
			this.context.bones!,
			this.context.srcCamera!,
			this.context.targetCamera!
		).then(outputs => {
			this.context.setLoading(false)
			this.context.updateForwardBtn({ enabled: true })
			if (!outputs) ToastUtils.makeToast("Failed to generate target view", "fail")
			else this.setState({ outputUrls: outputs })
			if (API.isDebug) console.log("[DemoOutput] Target view generation successful:", !!outputs)
			this.activeApiCall = null
		})
	}

	/** Context and state update callback */
	componentDidUpdate(): void {
		// Update extra button state
		if (this.context.prevState.step !== this.context.step) this.context.updateExtraBtn({ visible: this.context.step === 2 })
		
		// Ignore state changes except for input image and skeleton changes
		const sameInputs = this.context.prevState.segmentation === this.context.segmentation &&
			this.context.prevState.skeleton === this.context.skeleton &&
			this.context.prevState.bones === this.context.bones &&
			this.context.prevState.srcCamera === this.context.srcCamera &&
			this.context.prevState.targetCamera === this.context.targetCamera &&
			this.context.prevState.rotation === this.context.rotation
		if (
			sameInputs &&
			this.context.prevState.step === this.context.step &&
			this.context.prevState.reset === this.context.reset
		) return

		// Handle resetting state
		if (this.context.reset) return this.setState({ outputUrls: [] })

		// Update forward button when step changes
		if (this.context.prevState.step !== this.context.step && this.context.step === 2) {
			this.context.updateForwardBtn({ enabled: false })
			this.context.updateExtraBtn({ click: () => this.generateViews() })
		}

		// If this is the current view and anything changed in the previous steps, run the API call
		if (this.context.step === 2 && !sameInputs) {
			// Update forward button
			this.context.updateForwardBtn({
				text: "Start again",
				enabled: !this.context.loading,
				click: () => {
					this.context.resetState()
					const carousel = bootstrap.Carousel.getOrCreateInstance("#main", { wrap: false, keyboard: false, touch: false })
					carousel.to(0)
				}
			})
			// If all props are ready, make API call
			if (this.propsReady() && !this.activeApiCall) this.generateViews()
		}
	}
	
	/** Component render method */
	render(): ReactNode {
		return (
			<div className="col placeholder-glow">
				<h4 className="mb-2">Model outputs</h4>
				<div className="d-flex flex-wrap justify-content-center mb-3">
					{ this.context.loading ?
						<img src="/src/assets/transparent.png" className="placeholder bordered rounded output" /> :
						this.state.outputUrls.map((url, i) => (
							<img key={i} src={url} className={(i % 2 ? "ms-sm-2 " : "") + "mb-2 bordered rounded output"} />
						))
					}
				</div>
			</div>
		)
	}
	// #endregion
}