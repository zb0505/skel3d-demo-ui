import { Component, ReactNode } from "react"
import * as Three from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import API, { MeTRAbsResponse, Utils, CapeXInput, ExtrinsicMatrix, Point3D } from "../api_tools"
import ToastUtils from "../toast_tools"
import { AppContext } from "../contexts/AppContextProvider"


// Tree node structure
interface TreeNode {
	kp: string,
	child: TreeNode | null,
	next: TreeNode | null
}


// Component states
interface Skeleton3DState {
	skeletonData: MeTRAbsResponse["skeleton"] | null
}


/** Component for showing 3D skeleton */
export default class Skeleton3D extends Component<unknown, Skeleton3DState> {
	// #region Fields
	// App context
	static contextType = AppContext
	declare context: React.ContextType<typeof AppContext>
	
	/** 3D viewer canvas element */
	private canvas: HTMLCanvasElement | null = null
	
	/** Three.js scene for rendering */
	private scene: Three.Scene | null = null
	
	/** Three.js light */
	private light: Three.AmbientLight | null = null
	
	/** Perspective camera for viewing the scene */
	private camera: Three.PerspectiveCamera | null = null
	
	/** 3D renderer */
	private renderer: Three.WebGLRenderer | null = null
	
	/** Orbit controls for camera manipulation */
	private controls: OrbitControls | null = null
	
	/** Saved camera rotation for resetting camera */
	private cameraRotation: Three.Euler | null = null
	
	/** Skeleton joints' coordinates without modification for preview */
	private skeleton: MeTRAbsResponse["original"] | null = null
	
	/** Skeleton bones */
	private connections: CapeXInput["skeleton"] = []
	
	/** Min-max values for the skeleton coords */
	private minmax: NonNullable<MeTRAbsResponse["minmax"]> = []
	
	/** Currently active API call */
	private activeApiCall: Promise<unknown> | null = null
	
	/** Source camera extrinsic matrix */
	private srcCamera: ExtrinsicMatrix | null = null
	
	/** Last uploaded file, used to determine whether the file changed since skeleton generation */
	private prevFile: Blob | null = null
	
	/** Textual keypoints for CapeX */
	private keypoints: string = ""
	// #endregion


	// #region Constructor
	/** Component constructor */
	constructor(props: unknown) {
		super(props)
		this.state = { skeletonData: null }
	}
	// #endregion
	
	// #region Methods
	/** Component mounted (rendered) callback, prepares 3D library and tools */
	componentDidMount(): void {
		// Prepare scene and renderer
		const height = window.innerHeight - 300, width = window.innerWidth - 100
		const elem = this.canvas = document.querySelector("canvas#skeleton") as HTMLCanvasElement
		const scene = this.scene = new Three.Scene()
		const light = this.light = new Three.AmbientLight()
		const camera = this.camera = new Three.PerspectiveCamera(75, width / height, 0.001, 100000)
		const renderer = this.renderer = new Three.WebGLRenderer({ canvas: elem, antialias: true })
		const controls = this.controls = new OrbitControls(camera, elem)
		
		// Component settings
		camera.zoom = 1.2
		renderer.setSize(width, height)
		camera.updateProjectionMatrix()
		scene.background = new Three.Color("wheat")
		controls.enablePan = true
		controls.update()
		scene.add(light)
		camera.position.z = 5
		renderer.setAnimationLoop(() => renderer.render(scene, camera))
		if (API.isDebug) console.log("[Skeleton3D] Component:", this)

		// Update 3D renderer props on window resize
		window.addEventListener("resize", () => {
			const height = window.innerHeight - 300, width = window.innerWidth - 100
			renderer.setSize(width, height)
			camera.aspect = width / height
			camera.updateProjectionMatrix()
			controls.update()
			//this.resetCamera()
		})
	}

	/** Component unmount callback, cleans up 3D renderer and scene */
	componentWillUnmount(): void {
		this.renderer?.clear()
		this.renderer?.dispose()
		this.controls?.disconnect()
		this.controls?.dispose()
		this.scene?.clear()
		this.camera?.clear()
	}

	/** Context and state update callback */
	async componentDidUpdate(_prevProps: Readonly<unknown>, prevState: Readonly<Skeleton3DState>): Promise<void> {
		// Ignore state changes except for skeleton data
		const sameInputs = this.context.keypoints === this.keypoints &&
			this.context.prevState.segmentation === this.context.segmentation &&
			this.context.inFile === this.prevFile
		if (
			sameInputs &&
			prevState.skeletonData === this.state.skeletonData &&
			this.context.prevState.reset === this.context.reset &&
			this.context.prevState.step === this.context.step
		) return

		// Update forward button and process this step
		const btnDisabled = this.context.loading || !this.state.skeletonData || this.state.skeletonData.length < 1
		if (this.context.step === 1) {
			if (API.isDebug) console.log("[Skeleton3D] Updating forward button:", !btnDisabled)
			this.context.updateForwardBtn({
				text: "Generate",
				enabled: !btnDisabled,
				click: this.generateClicked.bind(this)
			})

			// Make API call and set skeleton data
			if (API.isDebug) console.log("[Skeleton3D] File:", this.context.inFile, ", prev file:", this.context.prevState.inFile,
				`\n  Step check:`, this.context.prevState.step !== this.context.step,
				`\n  Active API call check:`, !this.activeApiCall,
				`\n  File check:`, this.context.prevState.inFile !== this.context.inFile,
				`\n  Keypoints check:`, (this.context.keypoints ?? "") !== this.keypoints,
			)
			if (
				this.context.inFile !== null && this.context.segmentation !== null && !sameInputs &&
				this.context.prevState.step !== this.context.step && !this.activeApiCall
			) {
				if (API.isDebug) console.log("[Skeleton3D] File ready, loading skeleton data...")
				this.keypoints = this.context.keypoints ?? ""
				this.prevFile = this.context.inFile
				this.generateSkeleton()
			}
		}

		// Call ready handler when skeleton data is loaded
		if (prevState.skeletonData !== this.state.skeletonData) this.skeletonDataReady()
	}

	/** Checks if 3D tools are ready */
	private is3DReady(): boolean {
		return !!(this.canvas && this.scene && this.light && this.camera && this.renderer && this.controls)
	}

	/** Retrieves the extrinsic matrix of the given camera */
	private getExtrinsicMatrix(camera: Three.Camera): ExtrinsicMatrix {
		const matrix = camera.matrixWorldInverse.clone()
		matrix.transpose() // Convert column-major order to row-major order
		return [
			[...matrix.elements.slice(0, 4)],
			[...matrix.elements.slice(4, 8)],
			[...matrix.elements.slice(8, 12)],
			[...matrix.elements.slice(12)]
		] as ExtrinsicMatrix
	}

	/**
	 * Calculates the relative rotation of 2 extrinsic matrices.
	 * @returns Euler angles as XYZ tuple in radians (OpenCV convention)
	 */
	private getRelativeRotation(sourceExtrinsic: Three.Matrix4, targetExtrinsic: Three.Matrix4): Point3D {
		// Extract rotation matrices
		const source = new Three.Matrix4().extractRotation(sourceExtrinsic)
		const target = new Three.Matrix4().extractRotation(targetExtrinsic)

		// Calculate relative rotation
		const sourceInv = source.clone().invert()
		const relativeRot = new Three.Matrix4().multiplyMatrices(sourceInv, target)

		// Use XZY order for Euler extraction as OrbitControls rotates around X and Y only (thus avoiding gimbal lock)
		const euler = new Three.Euler().setFromRotationMatrix(relativeRot, "XZY")

		// Return the relative rotation angles
		if (API.isDebug) console.log("[Skeleton3D] Relative rotation (OpenCV convention):",
			"\n  X:", euler.x * 180 / Math.PI,
			"\n  Y:", -euler.y * 180 / Math.PI,
			"\n  Z:", -euler.z * 180 / Math.PI
		)
		return [euler.x, -euler.y, -euler.z]
	}

	/** Runs skeleton generation API call */
	private async generateSkeleton(): Promise<void> {
		if (!this.context.inFile || (API.skeletonModel === "capex" && !this.context.segmentation && !this.keypoints)) return
		this.context.setLoading(true)
		this.setState({ skeletonData: null })
		if (API.skeletonModel === "capex") {
			const kps = this.getKeypoints(this.keypoints)
			const img = this.context.segmentation ?? await Utils.fileToDataUrl(this.context.inFile)
			this.connections = this.buildConnections(this.keypoints)
			this.activeApiCall = API.skeletonCapex(img, kps, this.connections).then(data => {
				this.minmax = data.minmax || []
				this.skeleton = data.original?.map(xy => [...xy, 0]) || []
				this.setState({ skeletonData: data.skeleton || [] })
				this.context.setLoading(false)
				this.activeApiCall = null
			})
		}
		else this.activeApiCall = API.skeleton(await Utils.fileToDataUrl(this.context.inFile), this.context.bbox).then(data => {
			this.minmax = data.minmax || []
			this.skeleton = data.original || []
			this.connections = data.bones || []
			this.setState({ skeletonData: data.skeleton || [] })
			this.context.setLoading(false)
			this.activeApiCall = null
		})
	}

	/** Skeleton data ready callback */
	private skeletonDataReady(): void {
		if (API.isDebug) console.log("[Skeleton3D] Skeleton data ready:", this.state.skeletonData && this.is3DReady(), ", rendering", this.state.skeletonData?.length, "points")

		// Check if both 3D and skeleton data are ready
		if (!this.state.skeletonData || !this.is3DReady()) return
		if (this.state.skeletonData.length < 1) return ToastUtils.makeToast("Failed to create skeleton", "fail")
		if (API.isDebug) console.log("[Skeleton3D] Rendering skeleton data, skeleton:", this.state.skeletonData, ", connections:", this.connections)

		// Clear scene and add new skeleton data
		this.scene?.clear()
		this.scene?.add(this.light!)

		// Calculate camera position
		const maxDist = Math.max(...this.minmax.map(([min, max]) => max - min))
		const lookX = (this.minmax[0][1] - this.minmax[0][0]) / 2 + this.minmax[0][0]
		const lookY = (this.minmax[1][1] - this.minmax[1][0]) / 2 + this.minmax[1][0]
		const lookZ = (this.minmax[2][1] - this.minmax[2][0]) / 2 + this.minmax[2][0]
		
		// Iterate over points and add them to the scene
		const spheres: Three.Mesh[] = []
		for (const [x, y, z] of this.state.skeletonData) {
			const color = "#" + (Math.abs(x) * maxDist * 8 + Math.abs(y) * maxDist + Math.abs(z)).toString(16).slice(-6).padStart(6, "0")
			if (API.isDebug) console.log("[Skeleton3D] Adding sphere at:", x, y, z, ", color:", color)
			const geometry = new Three.SphereGeometry(0.02 * maxDist, 32, 32)
			const material = new Three.MeshBasicMaterial({ color })
			const sphere = new Three.Mesh(geometry, material)
			sphere.position.set(x, y, z)
			this.scene?.add(sphere)
			spheres.push(sphere)
		}

		// Iterate over connections and add the lines to the scene
		for (const [a, b] of this.connections) {
			const points = [spheres[a].position, spheres[b].position]
			const geometry = new Three.BufferGeometry().setFromPoints(points)
			const material = new Three.LineBasicMaterial({ color: "#00ceff" })
			const line = new Three.Line(geometry, material)
			this.scene?.add(line)
		}

		// Update camera position
		this.camera!.position.set(lookX, -lookY, lookZ - maxDist)
		this.cameraRotation = this.camera!.rotation.clone()
		this.camera!.lookAt(lookX, lookY, lookZ)
		this.controls!.update()
		this.srcCamera = this.getExtrinsicMatrix(this.camera!)
		if (API.isDebug) console.log("[Skeleton3D] Camera position:", this.camera?.position, ", maxDist:", maxDist, ", minmax:", this.minmax)
	}

	/** Generate button click callback */
	private generateClicked(): void {
		// Extract camera properties and update context state
		const targetCamera = this.getExtrinsicMatrix(this.camera!)
		const sourceMtx = new Three.Matrix4().fromArray(this.srcCamera!.flat() as Three.Matrix4Tuple).invert()
		const targetMtx = new Three.Matrix4().fromArray(targetCamera.flat() as Three.Matrix4Tuple).invert()
		this.context.updateState({
			skeleton: this.skeleton,
			bones: this.connections,
			srcCamera: this.srcCamera,
			rotation: this.getRelativeRotation(sourceMtx, targetMtx),
			targetCamera
		})
	}

	/** Resets camera position and look direction */
	private resetCamera(): void {
		// Check if both 3D and min-max values are ready
		if (this.minmax.length < 1 || !this.is3DReady()) return
		
		// Calculate camera original position
		const maxDist = Math.max(...this.minmax.map(([min, max]) => max - min))
		const lookX = (this.minmax[0][1] - this.minmax[0][0]) / 2 + this.minmax[0][0]
		const lookY = (this.minmax[1][1] - this.minmax[1][0]) / 2 + this.minmax[1][0]
		const lookZ = (this.minmax[2][1] - this.minmax[2][0]) / 2 + this.minmax[2][0]

		// Set camera properties and update controls
		this.camera!.position.set(lookX, -lookY, lookZ - maxDist)
		this.camera!.rotation.copy(this.cameraRotation!)
		this.camera!.lookAt(lookX, lookY, lookZ)
		this.controls!.update()
		this.srcCamera = this.getExtrinsicMatrix(this.camera!)
	}

	/** Retrieves the keypoint list from the input string */
	private getKeypoints(input: string): string[] {
		return input.split(/\n-*\s*/g).map(line => line.trim())
	}

	/** Traverses the given tree and collects connections */
	private traverse(node: TreeNode | null, parent: TreeNode, keypoints: string[]): [a: number, b: number][] {
		if (!node) return []
		if (API.isDebug) console.log("[Skeleton3D] Traversing:", node.kp, ", parent:", parent.kp)
		return [
			[keypoints.indexOf(parent.kp), keypoints.indexOf(node.kp)],
			...this.traverse(node.next, parent, keypoints),
			...this.traverse(node.child, node, keypoints)
		]
	}

	/** Builds the keypoint graph to connect points */
	private buildConnections(input: string): CapeXInput["skeleton"] {
		// List of keypoints
		const keypoints = this.getKeypoints(input)
		
		// The root is a special node that isn't part of the keypoints
		const root: TreeNode = { kp: "", child: null, next: null }
		const levelPrev = [root] // Keep track of the previous node on each level

		// Iterate over keypoints and make graph
		let prevNode = { ...root, lvl: 0 }
		for (const line of input.split("\n")) {
			const lvl = line.match(/^-+/)?.[0].length || 0
			const kp = line.replace(/^-+/, "").trim()
			const node = { kp, next: null, child: null }
			let current = levelPrev[lvl]
			if (!current || lvl > prevNode.lvl) {
				if (!current) levelPrev.push(node)
				levelPrev[lvl - 1].child = node
				levelPrev[lvl] = node
				prevNode = { ...node, lvl }
				continue
			}
			while (current.next) current = current.next
			current.next = node
			levelPrev[lvl] = node
			prevNode = { ...node, lvl }
		}

		// Start from the root and collect connections
		let connections: [a: number, b: number][] = this.traverse(root.next, root, keypoints)
		
		// Post-process connections and return them
		prevNode = root as typeof prevNode
		connections = connections.map(([a, b]) => {
			if (a < 0) {
				a = keypoints.indexOf(prevNode.kp)
				prevNode = (prevNode.next || {}) as typeof prevNode
			}
			return [a, b]
		}).filter(([a, b]) => a !== b && a >= 0 && b >= 0) as typeof connections
		return connections
	}
	
	/** Component render method */
	render(): ReactNode {
		return (
			<div className="d-flex flex-column align-items-center placeholder-glow">
				<h4 className="mb-2">3D skeleton for pose selection</h4>
				<canvas id="skeleton" ref={canvas => this.canvas = canvas}
					className={(!this.state.skeletonData ? "placeholder " : "") + "rounded mx-2"} />
				<div className="mt-2 d-flex flex-row">
					<button className="btn btn-outline-primary" onClick={() => this.generateSkeleton()}
						disabled={!this.state.skeletonData}>Re-generate skeleton</button>
					<button className="btn btn-outline-secondary ms-2" disabled={!this.state.skeletonData}
						onClick={() => this.resetCamera()}>Reset camera</button>
				</div>
			</div>
		)
	}
	// #endregion
}