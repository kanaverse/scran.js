#ifndef JS_VECTOR_H
#define JS_VECTOR_H

#include <cstddef>

/* Implements a vector representation of a TypedArray in the 
 * WASM buffer, created on the Javascript side and used here
 * to avoid unnecessary copies. This provides some methods 
 * that mimic a std::vector for use within tatami. 
 */

template<typename T>
class JSVector {
public:
    JSVector(const T* p, size_t n) : ptr(p), num(n) {}
    size_t size() const { return num; }
    const T* data() const { return ptr; }
    const T* begin() const { return ptr; }
    const T* end() const { return ptr + num; }
private:
    const T* ptr;
    size_t num;
};

#endif
