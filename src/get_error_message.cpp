#include <emscripten/bind.h>
#include <string>
#include <stdexcept>

std::string get_error_message(intptr_t ptr) {
  return std::string(reinterpret_cast<std::exception*>(ptr)->what());
}

EMSCRIPTEN_BINDINGS(Bindings) {
  emscripten::function("get_error_message", &get_error_message, emscripten::return_value_policy::take_ownership());
};
