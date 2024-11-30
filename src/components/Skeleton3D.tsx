import { Component, ReactNode } from "react"
import * as Three from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { OBJLoader } from "three/addons/loaders/OBJLoader.js"
import { dataUrlToBlob } from "../api_tools"
import { AppState } from "../App"


// Component props and states
interface Skeleton3DProps {
	file: File | null,
	loading: boolean,
	reset: boolean,
	step: number,
	setLoading: (loading: boolean) => void,
	onGenerateClicked: (skelImg: Blob) => void,
	updateForwardBtn: (newState: Partial<AppState["forwardBtn"]>) => void
}
interface Skeleton3DState {
	skeletonData: number[][] | null
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

		/* const geometry = new Three.BoxGeometry(1, 1, 1)
		const material = new Three.MeshBasicMaterial({ color: "#00ceff" })
		const cube = new Three.Mesh(geometry, material)
		scene.add(cube) */
		const loader = new OBJLoader()
		loader.load("/player.obj", obj => {
			const texture = new Three.TextureLoader().load("/playertexture.png")
			texture.colorSpace = Three.SRGBColorSpace
			obj.traverse(child => {
				const typed = child as Three.Mesh<Three.BufferGeometry, Three.MeshPhongMaterial>
				if (typed.isMesh) typed.material.map = texture
			})
			scene.add(obj)
			const skeleton = new Three.SkeletonHelper(obj)
			skeleton.visible = true
			scene.add(skeleton)
			renderer.render(scene, camera)
		})
		camera.position.z = 5
		renderer.setAnimationLoop(() => {
			/* cube.rotation.x += 0.01
			cube.rotation.y += 0.01 */
			renderer.render(scene, camera)
		})
		console.log("Component:", this)
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
	componentDidUpdate(prevProps: Readonly<Skeleton3DProps>, _prevState: Readonly<Skeleton3DState>, _snapshot?: any): void {
		// Ignore state changes
		if (prevProps.file === this.props.file && prevProps.reset === this.props.reset && prevProps.step === this.props.step) return

		// Update forward button
		const btnDisabled = this.props.loading || !this.state.skeletonData || this.state.skeletonData.length < 1
		if (this.props.step === 1) this.props.updateForwardBtn({
			text: "Generate",
			enabled: true || !btnDisabled,
			click: this.generateClicked.bind(this)
		})
		
		// TODO: do API call and set skeleton data
	}

	// Check if 3D library is ready
	private is3DReady(): boolean {
		return !!(this.canvas && this.scene && this.light && this.camera && this.mainRenderer && this.controls)
	}

	// Skeleton data ready handler
	private skeletonDataReady(): void {
		// Check if both 3D and skeleton data are ready
		if (!this.state.skeletonData || !this.is3DReady()) return

		// Clear scene and add new skeleton data
		this.scene.clear()
		this.scene.add(this.light)
		// TODO: add data here
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
			<div className="d-flex flex-column placeholder-glow">
				<h4 className="mb-2">3D skeleton for pose selection</h4>
				<canvas id="skeleton" className={(!this.state.skeletonData ? "placeholder " : "") + "rounded mx-2"} />
			</div>
		)
	}
}