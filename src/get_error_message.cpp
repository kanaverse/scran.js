#include <emscripten/bind.h>
#include <string>
#include <stdexcept>

/** 
 * Get the error message.
 * 
 * @param ptr Offset to the exception object, usually thrown by Wasm invocations.
 * 
 * @return String containing the error message.
 */
std::string get_error_message(intptr_t ptr) {
  return std::string(reinterpret_cast<std::exception*>(ptr)->what());
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(Bindings) {
  emscripten::function("get_error_message", &get_error_message);
};
/**
 * @endcond
 */

