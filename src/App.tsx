import { Component, ReactNode } from "react"
import FileUpload from "./components/FileUpload"
import Skeleton3D from "./components/Skeleton3D"
import DemoOutput from "./components/DemoOutput"
import { Point3D, Utils } from "./api_tools"
import * as bootstrap from "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "./App.css"
import AppContextProvider, { AppContext } from "./contexts/AppContextProvider"


// App states
export interface AppState {
	inFile: Blob | null,
	currSkel: Point3D[] | null,
	targetSkel: Point3D[] | null,
	loading: boolean,
	reset: boolean,
	step: number,
	forwardBtn: {
		text: string,
		enabled: boolean,
		click: () => void
	}
}


// App root component
export default class App extends Component<unknown, unknown, AppState> {
	// App context
	static contextType = AppContext
	declare context: React.ContextType<typeof AppContext>

	// Constructor
	constructor(props: object) {
		super(props)
	}

	// Forward button click event
	private onForwardBtnClicked(): void {
		this.context.forwardBtn.click()
		this.context.updateState({ step: (this.context.step + 1) % 3 })
		if (this.context.updatedState.step == 2) this.context.updateForwardBtn({
			text: "Start again",
			click: () => {
				const carousel = bootstrap.Carousel.getOrCreateInstance("#main", { wrap: false, keyboard: false, touch: false })
				carousel.to(0)
				this.context.updateState({ ...AppContextProvider.defaultState })
			}
		})
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
						<DemoOutput {...this.context}
							setLoading={loading => this.context.updateState({ loading })} step={this.context.step}
							updateForwardBtn={this.context.updateForwardBtn} />
					</div>
				</div>
				<button className="btn btn-secondary fab fab-left" type="button" data-bs-target="#main" data-bs-slide="prev"
					disabled={this.context.step < 1 || this.context.loading}
					onClick={() => this.context.updateState({ step: this.context.step - 1 })}>
					Previous
				</button>
				<button className="btn btn-primary fab fab-right" type="button" data-bs-target="#main" data-bs-slide="next"
					onClick={this.onForwardBtnClicked.bind(this)} disabled={!this.context.forwardBtn.enabled || this.context.loading}>
					{this.context.forwardBtn.text}
				</button>
			</div>
		</>)
	}
}
