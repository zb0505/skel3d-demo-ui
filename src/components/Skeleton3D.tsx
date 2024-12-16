import { Component, ReactNode } from "react"
import * as Three from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import API, { dataUrlToBlob, fileToDataUrl } from "../api_tools"
import { AppState } from "../App"
import FileUpload from "./FileUpload"
import makeToast from "../toast_tools"


// Tree node structure
interface TreeNode {
	kp: string,
	next: TreeNode | null,
	sibling: TreeNode | null
}


// Component props and states
interface Skeleton3DProps {
	file: Blob | null,
	loading: boolean,
	reset: boolean,
	step: number,
	setLoading: (loading: boolean) => void,
	onGenerateClicked: (skelImg: Blob) => void,
	updateForwardBtn: (newState: Partial<AppState["forwardBtn"]>) => void
}
interface Skeleton3DState {
	skeletonData: Awaited<ReturnType<typeof API["skeleton"]>> | null
}


// Skeleton 3D viewer class
export default class Skeleton3D extends Component<Skeleton3DProps, Skeleton3DState> {
	// 3D rendering helpers
	private canvas: HTMLCanvasElement = null!
	private scene: Three.Scene = null!
	private light: Three.AmbientLight = null!
	private camera: Three.PerspectiveCamera = null!
	private mainRenderer: Three.WebGLRenderer = null!
	private exportRenderer: Three.WebGLRenderer = null!
	private controls: OrbitControls = null!
	private connections: [a: number, b: number][] = []
	private activeApiCall: Promise<any> | null = null


	// Class constructor
	constructor(props: Skeleton3DProps) {
		super(props)
		this.state = { skeletonData: [] }
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
		this.exportRenderer = new Three.WebGLRenderer({ canvas: elem, antialias: true, preserveDrawingBuffer: true })
		const controls = this.controls = new OrbitControls(camera, elem)
		
		// Component settings
		camera.zoom = 2
		renderer.setSize(width, height)
		camera.updateProjectionMatrix()
		scene.background = new Three.Color("wheat")
		controls.enablePan = false
		controls.update()
		scene.add(light)
		camera.position.z = 5
		renderer.setAnimationLoop(() => renderer.render(scene, camera))
		console.log("[Skeleton3D] Component:", this)
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
	async componentDidUpdate(prevProps: Readonly<Skeleton3DProps>, prevState: Readonly<Skeleton3DState>, _snapshot?: any): Promise<void> {
		// Ignore state changes except for skeleton data
		if (
			prevState.skeletonData === this.state.skeletonData &&
			prevProps.file === this.props.file &&
			prevProps.reset === this.props.reset &&
			prevProps.step === this.props.step
		) return

		// Update forward button
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
			console.log("[Skeleton3D] File:", this.props.file, ", prev file:", prevProps.file, ", keypoints:", uploadInstance?.state.keypoints)
			if (
				this.props.file !== null && prevProps.step !== this.props.step &&
				uploadInstance?.state.keypoints && !this.activeApiCall
			) {
				console.log("[Skeleton3D] File ready, loading skeleton data...")
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
		const uploadInstance = FileUpload.getInstance()
		if (!uploadInstance || !this.props.file) return
		this.props.setLoading(true)
		this.setState({ skeletonData: null })
		const kps = this.getKeypoints(uploadInstance.state.keypoints)
		this.connections = this.buildConnections(uploadInstance.state.keypoints)
		this.activeApiCall = API.skeleton(await fileToDataUrl(this.props.file), kps).then(keypoints => {
			this.setState({ skeletonData: keypoints })
			this.props.setLoading(false)
			this.activeApiCall = null
		})
	}

	// Skeleton data ready handler
	private skeletonDataReady(): void {
		console.log("[Skeleton3D] Skeleton data ready:", this.state.skeletonData && this.is3DReady(), ", rendering", this.state.skeletonData?.length, "points")

		// Check if both 3D and skeleton data are ready
		if (!this.state.skeletonData || !this.is3DReady()) return
		if (this.state.skeletonData.length < 1) return makeToast("Failed to create skeleton", "fail")
		console.log("[Skeleton3D] Rendering skeleton data, skeleton:", this.state.skeletonData, ", connections:", this.connections)

		// Clear scene and add new skeleton data
		this.scene.clear()
		this.scene.add(this.light)

		const geometry = new Three.SphereGeometry(0.1, 32, 32)
		const material = new Three.MeshBasicMaterial({ color: "#00ceff" })
		const sphere = new Three.Mesh(geometry, material)
		sphere.position.set(0, 0, 0)
		this.scene.add(sphere)

		const sphere2 = new Three.Mesh(geometry, material)
		sphere2.position.set(10, 10, 0)
		this.scene.add(sphere2)
		
		// Iterate over points and add them to the scene
		const spheres: Three.Mesh[] = []
		for (const [x, y, z] of this.state.skeletonData) {
			const geometry = new Three.SphereGeometry(0.1, 32, 32)
			const material = new Three.MeshBasicMaterial({ color: "#00ceff" })
			const sphere = new Three.Mesh(geometry, material)
			sphere.position.set(x, y, z)
			this.scene.add(sphere)
			spheres.push(sphere)
		}

		// Iterate over connections and add the lines to the scene
		for (const [a, b] of this.connections) {
			const points = [spheres[a].position, spheres[b].position]
			const geometry = new Three.BufferGeometry().setFromPoints(points)
			const material = new Three.LineBasicMaterial({ color: "#00ceff", linewidth: 2 })
			const line = new Three.Line(geometry, material)
			this.scene.add(line)
		}
	}

	// User clicked the generate button
	private generateClicked() {
		// Capture canvas picture
		this.scene.background = new Three.Color("white")
		this.exportRenderer.render(this.scene, this.camera)
		const dataUrl = this.canvas.toDataURL()
		this.exportRenderer.clear()
		this.mainRenderer.render(this.scene, this.camera)
		this.scene.background = new Three.Color("wheat")
		const file = dataUrlToBlob(dataUrl)
		this.props.onGenerateClicked(file)
	}
	
	// Markup
	render(): ReactNode {
		return (
			<div className="d-flex flex-column align-items-center placeholder-glow">
				<h4 className="mb-2">3D skeleton for pose selection</h4>
				<canvas id="skeleton" className={(!this.state.skeletonData ? "placeholder " : "") + "rounded mx-2"} />
				<button className="btn btn-secondary mt-2" onClick={() => this.generateSkeleton()} disabled={!this.state.skeletonData}>Re-generate skeleton</button>
			</div>
		)
	}

	// Retrieve keypoint list from input
	private getKeypoints(input: string): string[] {
		return input.split(/\n-*\s*/g).map(line => line.trim())
	}

	// Build keypoint graph to connect points
	private buildConnections(input: string): [a: number, b: number][] {
		// List of keypoints
		const keypoints = this.getKeypoints(input)
		
		// The first keypoint will be the root
		const root: TreeNode = { kp: keypoints[0], next: null, sibling: null }
		const levelPrev = [root] // Keep track of the previous node on each level

		// Iterate over keypoints and make graph
		let prevNode = { ...root, lvl: 0 }
		for (const line of input.split("\n").slice(1)) {
			const lvl = line.match(/^-+/)?.[0].length || 0
			const kp = line.replace(/^-+/, "").trim()
			const node = { kp, next: null, sibling: null }
			let current = levelPrev[lvl]
			if (!current || lvl > prevNode.lvl) {
				if (!current) levelPrev.push(node)
				levelPrev[lvl - 1].next = node
				levelPrev[lvl] = node
				prevNode = { ...node, lvl }
				continue
			}
			while (current.sibling) current = current.sibling
			current.sibling = node
			levelPrev[lvl] = node
			prevNode = { ...node, lvl }
		}

		// Start from the root and collect connections
		const connections: [a: number, b: number][] = []
		const queue = [root]
		while (queue.length > 0) {
			let subRoot = queue.shift()
			if (!subRoot) continue
			
			// Connect level roots
			if (subRoot.next) {
				connections.push([keypoints.indexOf(subRoot.kp), keypoints.indexOf(subRoot.next.kp)])
				queue.push(subRoot.next)
			}

			// Connect siblings on the current level
			let current = subRoot.sibling
			while (current?.sibling) {
				// Connect nodes
				if (current.next) {
					connections.push([keypoints.indexOf(current.kp), keypoints.indexOf(current.next.kp)])
					queue.push(current.next)
				}
				connections.push([keypoints.indexOf(subRoot.kp), keypoints.indexOf(current.kp)])
				subRoot = current
				current = current.sibling
			}
		}
		return connections
	}
}