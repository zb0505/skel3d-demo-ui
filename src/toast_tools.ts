import * as bootstrap from "bootstrap"
import { Utils } from "./api_tools"


// Bootstrap toast tools
export type ToastType = "info" | "success" | "warn" | "fail"


/** Toast utilities */
export default class ToastUtils {
	/** Creates a toast of the given type (defaults to `info`) */
	static makeToast(message: string, type: ToastType = "info") {
		const container = document.getElementById("toasts")
		const template = container?.querySelector("div")?.cloneNode(true)
		if (!template) return
		container?.appendChild(template)
		const toast = container?.lastElementChild
		if (!toast) return
		toast.removeAttribute("hidden")
		toast.querySelector(".toast-body")!.textContent = message
		switch (type) {
			case "success":
				toast.classList.add("text-bg-success")
				break
			case "fail":
				toast.classList.add("text-bg-danger")
				break
			case "warn":
				toast.classList.add("text-bg-warning")
				break
			default:
				toast.classList.add("text-bg-primary")
				break
		}
		const bsToast = bootstrap.Toast.getOrCreateInstance(toast, { animation: true, autohide: true })
		Utils.once(toast, "hidden.bs.toast", () => container?.removeChild(toast))
		bsToast.show()
	}
}