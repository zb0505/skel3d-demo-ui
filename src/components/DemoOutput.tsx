import { Component, ReactNode } from "react"
import { fileToDataUrl } from "../api_tools"


// Component props and states
interface DemoOutputProps {
	inFile: File | null
	skelFile: Blob | null
	loading: boolean
}

interface DemoOutputState {
	outputUrl: string
}


// Demo output class
export default class DemoOutput extends Component<DemoOutputProps, DemoOutputState> {
	// Constructor
	constructor(props: DemoOutputProps) {
		super(props)
		this.state = { outputUrl: "" }
	}

	// Check if both input files are ready
	private filesReady(): boolean {
		return !!(this.props.inFile && this.props.skelFile)
	}

	// Query API when both input files are ready
	async componentDidUpdate(prevProps: Readonly<DemoOutputProps>, _prevState: Readonly<DemoOutputState>, _snapshot?: any): Promise<void> {
		// Ignore state changes
		if (prevProps === this.props) return

		// If both files are ready, make API call
		if (this.filesReady()) {
			// TODO: image generator API call here
		}
		this.setState({ outputUrl: this.props.inFile ? await fileToDataUrl(this.props.inFile) : "" })
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