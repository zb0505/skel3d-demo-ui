import { Component, ReactNode } from "react"
import FileUpload from "./components/FileUpload"
import Skeleton3D from "./components/Skeleton3D"
import DemoOutput from "./components/DemoOutput"
import API, { Utils } from "./api_tools"
import { AppContext } from "./contexts/AppContextProvider"
import "bootstrap/dist/css/bootstrap.min.css"
import "./App.css"


// App root component
export default class App extends Component<unknown> {
	// App context
	static contextType = AppContext
	declare context: React.ContextType<typeof AppContext>

	// Constructor
	constructor(props: unknown) {
		super(props)
	}

	// Forward button click event
	private onForwardBtnClicked(): void {
		if (API.isDebug) console.log("[App] Forward button clicked, context:", this.context)
		if (this.context.step < 2) this.context.updateState({ step: (this.context.step + 1) % 3 })
		this.context.forwardBtn.click()
	}

	// Update tooltips on the page
	componentDidUpdate(): void {
		Utils.updateTooltips()
	}

	// Markup
	render(): ReactNode {
		return (<>
			<h1 className="mb-5">Skel3D demo</h1>
			<div id="main" className="carousel slide" data-bs-wrap="false" data-bs-touch="false" data-bs-keyboard="false">
				<div className="carousel-inner main-content">
					<div className="carousel-item mb-5 mb-lg-0 active">
						<FileUpload />
					</div>
					<div className="carousel-item mb-5 mb-lg-0">
						<Skeleton3D />
					</div>
					<div className="carousel-item mb-5 mb-lg-0">
						<DemoOutput />
					</div>
				</div>
				<button className="btn btn-secondary fab fab-left" type="button" data-bs-target="#main" data-bs-slide="prev"
					disabled={this.context.step < 1 || this.context.loading}
					onClick={() => this.context.updateState({ step: this.context.step - 1 })}>
					Previous
				</button>
				<button className="btn btn-primary fab" type="button" style={{ right: "8rem" }}
					disabled={!this.context.extraBtn.enabled || this.context.loading}
					hidden={!this.context.extraBtn.visible}
					onClick={() => this.context.extraBtn.click()}>
					{this.context.extraBtn.text}
				</button>
				<button className="btn btn-primary fab fab-right" type="button" data-bs-target="#main" data-bs-slide="next"
					disabled={!this.context.forwardBtn.enabled || this.context.loading}
					onClick={this.onForwardBtnClicked.bind(this)}>
					{this.context.forwardBtn.text}
				</button>
			</div>
		</>)
	}
}
