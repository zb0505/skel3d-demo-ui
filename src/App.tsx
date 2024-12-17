import { Component, ReactNode } from "react"
import FileUpload from "./components/FileUpload"
import Skeleton3D from "./components/Skeleton3D"
import DemoOutput from "./components/DemoOutput"
import { updateTooltips } from "./api_tools"
import * as bootstrap from "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "./App.css"


// App states
export interface AppState {
	inFile: Blob | null,
	skelFile: Blob | null,
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
export default class App extends Component<{}, AppState> {
	// State copy for proper state updates
	private stateCopy: AppState
	

	// Constructor
	constructor(props: {}) {
		super(props)
		this.state = this.stateCopy = {
			step: 0,
			inFile: null,
			skelFile: null,
			loading: false,
			reset: false,
			forwardBtn: {
				text: "Next",
				enabled: true,
				click: () => {}
			}
		}
	}

	// Update state
	private updateState(newState: Partial<AppState>) {
		this.stateCopy = { ...this.stateCopy, ...newState }
		this.setState(this.stateCopy)
	}

	// Update forward button state
	private updateForwardBtn(newState: Partial<AppState["forwardBtn"]>) {
		console.log("[App] Forward btn updated:", newState)
		this.updateState({ forwardBtn: { ...this.stateCopy.forwardBtn, ...newState } })
	}

	// Forward button click event
	private onForwardBtnClicked() {
		this.state.forwardBtn.click()
		this.updateState({ step: (this.state.step + 1) % 3 })
		if (this.stateCopy.step == 2) this.updateForwardBtn({
			text: "Start again",
			click: () => {
				const carousel = bootstrap.Carousel.getOrCreateInstance("#main", { wrap: false, keyboard: false, touch: false })
				carousel.to(0)
				this.updateState({
					step: 0,
					reset: true,
					inFile: null,
					skelFile: null,
					forwardBtn: {
						text: "Next",
						enabled: true,
						click: () => {}
					}
				})
			}
		})
	}

	// Update tooltips on the page
	componentDidUpdate(_prevProps: Readonly<{}>, _prevState: Readonly<AppState>, _snapshot?: any): void {
		updateTooltips()
	}

	// Markup
	render(): ReactNode {
		return (<>
			<h1 className="mb-5">Skel3D demo</h1>
			<div id="main" className="carousel slide" data-bs-wrap="false" data-bs-touch="false" data-bs-keyboard="false">
				<div className="carousel-inner main-content">
					<div className="carousel-item mb-5 mb-lg-0 active">
						<FileUpload reset={this.state.reset} step={this.state.step}
							onFileReady={file => this.updateState({ inFile: file, reset: false })}
							updateForwardBtn={this.updateForwardBtn.bind(this)} />
					</div>
					<div className="carousel-item mb-5 mb-lg-0">
						<Skeleton3D file={this.state.inFile} step={this.state.step}
							loading={this.state.loading} reset={this.state.reset}
							setLoading={loading => this.updateState({ loading })}
							updateForwardBtn={this.updateForwardBtn.bind(this)}
							onGenerateClicked={file => this.updateState({ skelFile: file })} />
					</div>
					<div className="carousel-item mb-5 mb-lg-0">
						<DemoOutput loading={this.state.loading} inFile={this.state.inFile} skelFile={this.state.skelFile}
							step={this.state.step} updateForwardBtn={this.updateForwardBtn.bind(this)} />
					</div>
				</div>
				<div className="d-flex flex-row justify-content-between fixed-bottom mx-3 mb-3">
					<button className="btn btn-secondary" type="button" data-bs-target="#main" data-bs-slide="prev"
						disabled={this.state.step < 1 || this.state.loading} onClick={() => this.updateState({ step: this.state.step - 1 })}>
						Previous
					</button>
					<button className="btn btn-primary" type="button" data-bs-target="#main" data-bs-slide="next"
						onClick={this.onForwardBtnClicked.bind(this)} disabled={!this.state.forwardBtn.enabled || this.state.loading}>
						{this.state.forwardBtn.text}
					</button>
				</div>
			</div>
		</>)
	}
}
