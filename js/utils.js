import Module from "./Module.js";

export function processErrorMessage(e) {
    if (e instanceof Number) {
        return Module.get_error_message(e);
    } else {
        return e;
    }
}
