import React, { createContext } from "react"
import { BoundingBox, ExtrinsicMatrix, Point2D, Point3D } from "../api_tools"


// App states
export interface AppState {
	/** Input file */
	inFile: Blob | null,
	/** Skeleton joints' coordinates */
	skeleton: Point3D[] | null,
	/** Skeleton bones */
	bones: Point2D[] | null,
	/** Source camera view */
	srcCamera: ExtrinsicMatrix | null,
	/** Target camera view */
	targetCamera: ExtrinsicMatrix | null,
	/** Bounding box (for MeTRAbs) */
	bbox: BoundingBox | null,
	/** Loading state */
	loading: boolean,
	/** Reset state */
	reset: boolean,
	/** Current step */
	step: number,
	/** Keypoints (for CapeX) */
	keypoints: string,
	/** Forward button state */
	forwardBtn: {
		/** Button text */
		text: string,
		/** Button enabled state */
		enabled: boolean,
		/** Button click action */
		click: () => void
	}
}

// App state changes
export type AppStateChanges = {
	[K in keyof AppState]: {
		old: AppState[K],
		new: AppState[K]
	}
}

// App context services
export type AppContextServices = AppState & {
	/** Previous context state */
	prevState: AppState,
	/** Context state that updates immediately */
	updatedState: AppState,
	/** List of state changes */
	stateChanges: Partial<AppStateChanges> | null,
	/** Set loading state */
	setLoading: (loading: boolean) => void,
	/** Update context state */
	updateState: (newState: Partial<AppState>) => void,
	/** Update forward button state */
	updateForwardBtn: (newState: Partial<AppState["forwardBtn"]>) => void
}


// App context
export const AppContext = createContext({} as AppContextServices)

// App context provider
export default class AppContextProvider extends React.Component<React.PropsWithChildren<unknown>, AppState> {
	/** Context state that updates immediately */
	private updatedState: AppState

	/** Context previous state */
	private prevState: AppState

	/** List of state keys that changed */
	private stateChanges: Partial<AppStateChanges> | null = null

	/** Default context state */
	static defaultState: AppState = {
		step: 0,
		inFile: null,
		skeleton: null,
		bones: null,
		srcCamera: null,
		targetCamera: null,
		bbox: null,
		loading: false,
		reset: false,
		keypoints: "",
		forwardBtn: {
			text: "Next",
			enabled: true,
			click: () => {}
		}
	}
	
	// Constructor
	constructor(props: React.PropsWithChildren<unknown>) {
		super(props)
		this.state = this.updatedState = this.prevState = { ...AppContextProvider.defaultState }
	}

	// Update state
	private updateState(newState: Partial<AppState>): void {
		this.setState(prevState => (this.updatedState = { ...prevState, ...newState }))
	}

	// Update forward button state
	private updateForwardBtn(newState: Partial<AppState["forwardBtn"]>): void {
		this.setState(prevState => (this.updatedState = {
			...prevState,
			forwardBtn: {
				...prevState.forwardBtn,
				...newState
			}
		}))
	}

	// Component updated event
	componentDidUpdate(_prevProps: Readonly<React.PropsWithChildren<unknown>>, prevState: Readonly<AppState>): void {
		// Store the previous state
		this.prevState = prevState
		
		// Get the difference between the previous and current state
		if (prevState !== this.state) {
			this.stateChanges = Object.keys(this.state).reduce((changes, key) => {
				const k = key as keyof AppState
				if (prevState[k] !== this.state[k]) {
					changes = { ...changes, [k]: { old: prevState[k], new: this.state[k] } }
				}
				return changes
			}, {})
		}
	}
	
	// Render method
	render(): React.JSX.Element {
		const services: AppContextServices = {
			...this.state,
			prevState: this.prevState,
			stateChanges: this.stateChanges,
			updatedState: this.updatedState,
			setLoading: (loading: boolean) => this.updateState({ loading }),
			updateState: (newState: Partial<AppState>) => this.updateState(newState),
			updateForwardBtn: (newState: Partial<AppState["forwardBtn"]>) => this.updateForwardBtn(newState)
		}

		return <AppContext.Provider value={services}>{this.props.children}</AppContext.Provider>
	}
}
