import React, { useEffect } from "react"
import * as bootstrap from "bootstrap"
import { Utils } from "../api_tools"


// Assign custom ID for each modal
let modalId = 0

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


export default function Modal({
	id, shown, setShown, title, body, submitText, cancelText,
	onSubmit = () => {},
	submitColor = "primary"
}: ModalProps) {
	// Assign a custom ID for this modal
	const mid = id ? id : `modal${modalId++}`

	// Show/hide modal when state changes
	useEffect(() => {
		const modalElem = document.getElementById(mid)
		if (!modalElem) return
		const modal = bootstrap.Modal.getOrCreateInstance(modalElem, { keyboard: true, backdrop: true })
		Utils.once(modalElem, "hidden.bs.modal", () => setShown(false))
		if (shown) modal.show()
		else modal.hide()
	}, [shown])

	// Submit modal
	function submit() {
		setShown(false)
		onSubmit()
	}
	
	// Markup
	return (
		<form id={mid} className="modal fade" tabIndex={-1} onSubmit={e => e.preventDefault()}>
			<div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
				<div className="modal-content">
					<div className="modal-header">
						<h5 className="modal-title">{title}</h5>
						<button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
					</div>
					<div className="modal-body">{typeof body === "string" ? <p>{body}</p> : body}</div>
					<div className="modal-footer">
						<button type="button" className="btn btn-secondary" data-bs-dismiss="modal">{cancelText ?? "Close"}</button>
						<button type="button" className={`btn btn-${submitColor}`} onClick={submit} hidden={!submitText}>{submitText}</button>
					</div>
				</div>
			</div>
		</form>
	)
}