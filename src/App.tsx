import { Component, ReactNode } from "react"
import FileUpload from "./components/FileUpload"
import Skeleton3D from "./components/Skeleton3D"
import DemoOutput from "./components/DemoOutput"
import "bootstrap/dist/css/bootstrap.min.css"
import "./App.css"
import { updateTooltips } from "./api_tools"


// App states
interface AppState {
	inFile: File | null
	skelFile: Blob | null
	loading: boolean,
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
			inFile: null,
			skelFile: null,
			loading: false,
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
		this.updateState({ forwardBtn: { ...this.stateCopy.forwardBtn, ...newState } })
	}

	// Update tooltips on the page
	componentDidUpdate(_prevProps: Readonly<{}>, _prevState: Readonly<AppState>, _snapshot?: any): void {
		updateTooltips()
	}

	// Markup
	render(): ReactNode {
		return (<>
			<h1 className="mb-5">Skel3D demo</h1>
			<div id="main" className="carousel slide">
				<div className="carousel-inner main-content">
					<div className="carousel-item active">
						<FileUpload onFileReady={file => this.updateState({ inFile: file })} />
					</div>
					<div className="carousel-item">
						<Skeleton3D file={this.state.inFile} loading={this.state.loading}
							setLoading={loading => this.updateState({ loading })}
							onGenerateClicked={file => this.updateState({ skelFile: file })} />
					</div>
					<div className="carousel-item">
						<DemoOutput loading={this.state.loading} inFile={this.state.inFile} skelFile={this.state.skelFile} />
					</div>
				</div>
				{/* TODO: remember states unless something changes in previous steps, then forget all steps after that */}
				<div className="d-flex flex-row justify-content-between fixed-bottom mx-3 mb-3">
					<button className="btn btn-secondary" type="button" data-bs-target="#main" data-bs-slide="prev">
						Previous
					</button>
					<button className="btn btn-primary" type="button" data-bs-target="#main" data-bs-slide="next"
						onClick={this.state.forwardBtn.click}>
						{this.state.forwardBtn.text}
					</button>
				</div>
			</div>
		</>)
	}
}
