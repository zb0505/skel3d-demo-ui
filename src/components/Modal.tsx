import React from "react"
import * as bootstrap from "bootstrap"
import { Utils } from "../api_tools"


// Modal props
interface ModalProps {
	id?: string,
	shown: boolean,
	setShown: (shown: boolean) => void,
	title: string,
	body: string | React.JSX.Element | React.JSX.Element[],
	submitText?: string,
	cancelText?: string,
	submitColor?: string,
	onSubmit?: () => void,
	onClose?: () => void
}


/** Bootstrap modal React-based implementation */
export default class Modal extends React.Component<ModalProps> {
	// #region Fields
	/** ID counter for modals that have no custom ID set */
	private static modalId = 0
	
	/** Modal ID */
	private id: string
	// #endregion
	
	// #region Constructor
	/** Component constructor */
	constructor(props: ModalProps) {
		super(props)
		this.id = props.id ? props.id : `modal${Modal.modalId++}`
	}
	// #endregion

	// #region Methods
	/** Submit button callback */
	private onSubmit(): void {
		this.props.setShown(false)
		if (this.props.onSubmit) this.props.onSubmit()
	}

	/** Component state update callback */
	componentDidUpdate(): void {
		const modalElem = document.getElementById(this.id)
		if (!modalElem) return
		const modal = bootstrap.Modal.getOrCreateInstance(modalElem, { keyboard: true, backdrop: true })
		Utils.once(modalElem, "hidden.bs.modal", () => this.props.setShown(false))
		if (this.props.shown) modal.show()
		else modal.hide()
	}
	
	/** Component render method */
	render(): React.ReactNode {
		// Show/hide modal when state changes
		const { title, body, submitText, cancelText, submitColor } = this.props
		return (
			<form id={this.id} className="modal fade" tabIndex={-1} onSubmit={e => e.preventDefault()}>
				<div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
					<div className="modal-content">
						<div className="modal-header">
							<h5 className="modal-title">{title}</h5>
							<button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
						</div>
						<div className="modal-body">{typeof body === "string" ? <p>{body}</p> : body}</div>
						<div className="modal-footer">
							<button type="button" className="btn btn-secondary" data-bs-dismiss="modal">{cancelText ?? "Close"}</button>
							<button type="button" className={`btn btn-${submitColor}`}
								onClick={() => this.onSubmit()} hidden={!submitText}>
								{submitText}
							</button>
						</div>
					</div>
				</div>
			</form>
		)
	}
}