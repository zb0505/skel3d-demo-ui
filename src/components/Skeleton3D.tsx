import { Component, ReactNode } from "react"
import * as Three from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import API, { MeTRAbsResponse, Utils, CapeXInput, Point3D } from "../api_tools"
import { AppState } from "../App"
import FileUpload from "./FileUpload"
import ToastUtils from "../toast_tools"


// Tree node structure
interface TreeNode {
	kp: string,
	child: TreeNode | null,
	next: TreeNode | null
}


// Component props and states
interface Skeleton3DProps {
	file: Blob | null,
	loading: boolean,
	reset: boolean,
	step: number,
	setLoading: (loading: boolean) => void,
	onGenerateClicked: (currSkel: Point3D[], targetSkel: Point3D[]) => void,
	updateForwardBtn: (newState: Partial<AppState["forwardBtn"]>) => void
}
interface Skeleton3DState {
	skeletonData: MeTRAbsResponse["skeleton"] | null
}


// Skeleton 3D viewer class
export default class Skeleton3D extends Component<Skeleton3DProps, Skeleton3DState> {
	// 3D rendering helpers
	private canvas: HTMLCanvasElement = null!
	private scene: Three.Scene = null!
	private light: Three.AmbientLight = null!
	private camera: Three.PerspectiveCamera = null!
	private mainRenderer: Three.WebGLRenderer = null!
	private controls: OrbitControls = null!
	private cameraRotation: Three.Euler = null!
	private connections: CapeXInput["skeleton"] = []
	private minmax: MeTRAbsResponse["minmax"] = []
	private activeApiCall: Promise<unknown> | null = null
	private origRotation: number[] = [0, 0]
	private prevFile: Blob | null = null
	private keypoints: string = ""


	// Class constructor
	constructor(props: Skeleton3DProps) {
		super(props)
		this.state = { skeletonData: null }
	}

	// Prepare canvas and 3D library
	componentDidMount(): void {
		// Prepare scene and renderer
		const height = window.innerHeight - 300, width = window.innerWidth - 100
		const elem = this.canvas = document.querySelector("canvas#skeleton") as HTMLCanvasElement
		const scene = this.scene = new Three.Scene()
		const light = this.light = new Three.AmbientLight()
		const camera = this.camera = new Three.PerspectiveCamera(75, width / height, 0.1, 1000)
		const renderer = this.mainRenderer = new Three.WebGLRenderer({ canvas: elem, antialias: true })
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
		console.log("[Skeleton3D] Component:", this)

		// Update 3D renderer props on window resize
		window.addEventListener("resize", () => {
			const height = window.innerHeight - 300, width = window.innerWidth - 100
			renderer.setSize(width, height)
			camera.aspect = width / height
			camera.updateProjectionMatrix()
			controls.update()
			this.resetCamera()
		})
	}

	// Clean up 3D renderer and scene
	componentWillUnmount(): void {
		this.mainRenderer.clear()
		this.mainRenderer.dispose()
		this.controls.disconnect()
		this.controls.dispose()
		this.scene.clear()
		this.camera.clear()
	}

	// File change listener
	async componentDidUpdate(prevProps: Readonly<Skeleton3DProps>, prevState: Readonly<Skeleton3DState>): Promise<void> {
		// Ignore state changes except for skeleton data
		if (
			prevState.skeletonData === this.state.skeletonData &&
			prevProps.file === this.props.file &&
			prevProps.reset === this.props.reset &&
			prevProps.step === this.props.step
		) return

		// Update forward button and process this step
		const btnDisabled = this.props.loading || !this.state.skeletonData || this.state.skeletonData.length < 1
		if (this.props.step === 1) {
			console.log("[Skeleton3D] Updating forward button:", !btnDisabled)
			this.props.updateForwardBtn({
				text: "Generate",
				enabled: !btnDisabled,
				click: this.generateClicked.bind(this)
			})

			// Make API call and set skeleton data
			const uploadInstance = FileUpload.getInstance()
			console.log("[Skeleton3D] File:", this.props.file, ", prev file:", prevProps.file,
				`\n  Step check:`, prevProps.step !== this.props.step,
				`\n  Active API call check:`, !this.activeApiCall,
				`\n  File check:`, prevProps.file !== this.props.file,
				`\n  Keypoints check:`, (uploadInstance?.state.keypoints ?? "") !== this.keypoints,
			)
			if (
				this.props.file !== null && prevProps.step !== this.props.step && !this.activeApiCall &&
				((uploadInstance?.state.keypoints ?? "") !== this.keypoints || this.prevFile !== this.props.file)
			) {
				console.log("[Skeleton3D] File ready, loading skeleton data...")
				this.keypoints = uploadInstance?.state.keypoints ?? ""
				this.prevFile = this.props.file
				this.generateSkeleton()
			}
		}

		// Call ready handler when skeleton data is loaded
		if (prevState.skeletonData !== this.state.skeletonData) this.skeletonDataReady()
	}

	// Check if 3D library is ready
	private is3DReady(): boolean {
		return !!(this.canvas && this.scene && this.light && this.camera && this.mainRenderer && this.controls)
	}

	// Run skeleton generation
	private async generateSkeleton(): Promise<void> {
		if (!this.keypoints || !this.props.file) return
		this.props.setLoading(true)
		this.setState({ skeletonData: null })
		if (API.skeletonModel === "capex") {
			const kps = this.getKeypoints(this.keypoints)
			this.connections = this.buildConnections(this.keypoints)
			this.activeApiCall = API.skeleton_capex(await Utils.fileToDataUrl(this.props.file), kps, this.connections).then(data => {
				this.minmax = data.minmax
				this.setState({ skeletonData: data.skeleton })
				this.props.setLoading(false)
				this.activeApiCall = null
			})
		}
		else this.activeApiCall = API.skeleton(await Utils.fileToDataUrl(this.props.file)).then(data => {
			this.minmax = data.minmax
			this.setState({ skeletonData: data.skeleton })
			this.props.setLoading(false)
			this.activeApiCall = null
		})
	}

	// Skeleton data ready handler
	private skeletonDataReady(): void {
		console.log("[Skeleton3D] Skeleton data ready:", this.state.skeletonData && this.is3DReady(), ", rendering", this.state.skeletonData?.length, "points")

		// Check if both 3D and skeleton data are ready
		if (!this.state.skeletonData || !this.is3DReady()) return
		if (this.state.skeletonData.length < 1) return ToastUtils.makeToast("Failed to create skeleton", "fail")
		console.log("[Skeleton3D] Rendering skeleton data, skeleton:", this.state.skeletonData, ", connections:", this.connections)

		// Clear scene and add new skeleton data
		this.scene.clear()
		this.scene.add(this.light)

		// Calculate camera position
		const maxDist = Math.max(...this.minmax.map(([min, max]) => max - min))
		const lookX = (this.minmax[0][1] - this.minmax[0][0]) / 2 + this.minmax[0][0]
		const lookY = (this.minmax[1][1] - this.minmax[1][0]) / 2 + this.minmax[1][0]
		const lookZ = (this.minmax[2][1] - this.minmax[2][0]) / 2 + this.minmax[2][0]
		
		// Iterate over points and add them to the scene
		const spheres: Three.Mesh[] = []
		for (const [x, y, z] of this.state.skeletonData) {
			const color = "#" + (Math.abs(x) * maxDist * 8 + Math.abs(y) * maxDist + Math.abs(z)).toString(16).slice(-6).padStart(6, "0")
			console.log("[Skeleton3D] Adding sphere at:", x, y, z, ", color:", color)
			const geometry = new Three.SphereGeometry(0.02 * maxDist, 32, 32)
			const material = new Three.MeshBasicMaterial({ color })
			const sphere = new Three.Mesh(geometry, material)
			sphere.position.set(x, y, z)
			this.scene.add(sphere)
			spheres.push(sphere)
		}

		// Iterate over connections and add the lines to the scene
		for (const [a, b] of this.connections) {
			const points = [spheres[a].position, spheres[b].position]
			const geometry = new Three.BufferGeometry().setFromPoints(points)
			const material = new Three.LineBasicMaterial({ color: "#00ceff" })
			const line = new Three.Line(geometry, material)
			this.scene.add(line)
		}

		// Update camera position
		this.camera.position.set(lookX, lookY, lookZ + maxDist)
		this.cameraRotation = this.camera.rotation.clone()
		this.controls.update()
		this.origRotation = [this.controls.getPolarAngle(), this.controls.getAzimuthalAngle()]
		console.log("[Skeleton3D] Camera position:", this.camera.position, ", maxDist:", maxDist, ", minmax:", this.minmax)
	}

	// User clicked the generate button
	private generateClicked(): void {
		let currSkel = this.state.skeletonData || []
		if (API.skeletonModel === "capex") {
			// Remove 3D coords and un-centralize 2D coords
			const img = document.querySelector("#preview") as HTMLImageElement
			const imgWidth = img.naturalWidth, imgHeight = img.naturalHeight
			currSkel = this.state.skeletonData?.map(([x, y]) => [x + Math.floor(imgWidth / 2), y + Math.floor(imgHeight / 2), 0]) || []
		}

		// Transform skeleton coords with camera rotation
		const targetSkel: Point3D[] = currSkel.map(([x, y, z]) => {
			const vec = new Three.Vector3(x, y, z)
			vec.applyAxisAngle(new Three.Vector3(1, 0, 0), this.controls.getPolarAngle() - this.origRotation[0])
			vec.applyAxisAngle(new Three.Vector3(0, 1, 0), this.controls.getAzimuthalAngle() - this.origRotation[1])
			vec.projectOnPlane(new Three.Vector3(0, 0, 1)).round()
			console.log("[Skeleton3D] Vector projection:", vec, ", orig coords:", [x, y, z])
			return [vec.x, vec.y, vec.z]
		})

		// Pass skeleton coords to next component
		this.props.onGenerateClicked(currSkel, targetSkel)
	}

	// Reset camera position and look direction
	private resetCamera(): void {
		// Check if both 3D and min-max values are ready
		if (this.minmax.length < 1 || !this.is3DReady()) return
		
		// Calculate camera original position
		const maxDist = Math.max(...this.minmax.map(([min, max]) => max - min))
		const lookX = (this.minmax[0][1] - this.minmax[0][0]) / 2 + this.minmax[0][0]
		const lookY = (this.minmax[1][1] - this.minmax[1][0]) / 2 + this.minmax[1][0]
		const lookZ = (this.minmax[2][1] - this.minmax[2][0]) / 2 + this.minmax[2][0]

		// Set camera properties and update controls
		this.camera.position.set(lookX, lookY, lookZ + maxDist)
		this.camera.rotation.set(this.cameraRotation.x, this.cameraRotation.y, this.cameraRotation.z)
		this.controls.update()
		this.origRotation = [this.controls.getPolarAngle(), this.controls.getAzimuthalAngle()]
	}

	// Retrieve keypoint list from input
	private getKeypoints(input: string): string[] {
		return input.split(/\n-*\s*/g).map(line => line.trim())
	}

	// Traverse tree and collect connections
	private traverse(node: TreeNode | null, parent: TreeNode, keypoints: string[]): [a: number, b: number][] {
		if (!node) return []
		console.log("[Skeleton3D] Traversing:", node.kp, ", parent:", parent.kp)
		return [
			[keypoints.indexOf(parent.kp), keypoints.indexOf(node.kp)],
			...this.traverse(node.next, parent, keypoints),
			...this.traverse(node.child, node, keypoints)
		]
	}

	// Build keypoint graph to connect points
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
	
	// Markup
	render(): ReactNode {
		return (
			<div className="d-flex flex-column align-items-center placeholder-glow">
				<h4 className="mb-2">3D skeleton for pose selection</h4>
				<canvas id="skeleton" className={(!this.state.skeletonData ? "placeholder " : "") + "rounded mx-2"} />
				<div className="mt-2 d-flex flex-row">
					<button className="btn btn-outline-primary" onClick={() => this.generateSkeleton()}
						disabled={!this.state.skeletonData}>Re-generate skeleton</button>
					<button className="btn btn-outline-secondary ms-2" disabled={!this.state.skeletonData}
						onClick={() => this.resetCamera()}>Reset camera</button>
				</div>
			</div>
		)
	}
}