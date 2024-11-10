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
	loading: boolean
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
			loading: false
		}
	}

	// Update state
	private updateState(newState: Partial<AppState>) {
		this.stateCopy = { ...this.stateCopy, ...newState }
		this.setState(this.stateCopy)
	}

	// Update tooltips on the page
	componentDidUpdate(_prevProps: Readonly<{}>, _prevState: Readonly<AppState>, _snapshot?: any): void {
		updateTooltips()
	}

	// Markup
	render(): ReactNode {
		return (<>
			<h1 className="mb-5">Skel3D demo</h1>
			<div className="d-flex flex-column flex-lg-row justify-content-between">
				<FileUpload onFileReady={file => this.updateState({ inFile: file })} />
				<Skeleton3D file={this.state.inFile} loading={this.state.loading}
					setLoading={loading => this.updateState({ loading })}
					onGenerateClicked={file => this.updateState({ skelFile: file })} />
				<DemoOutput loading={this.state.loading} inFile={this.state.inFile} skelFile={this.state.skelFile} />
			</div>
		</>)
	}
}
