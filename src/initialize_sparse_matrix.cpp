#include <emscripten/bind.h>
#include "NumericMatrix.h"

#include "tatami/tatami.hpp"
#include "tatami/utils/NakedArray.hpp"
#include "tatami/ext/convert_to_layered_sparse.hpp"
#include <cstdint>

template<typename T>
struct SuperNakedArray {
    SuperNakedArray(uintptr_t x, size_t n, std::string type) : len(n) {
        if (type == "Int8Array") {
            current = I8;
            i8 = spawn<int8_t>(x, len);
        } else if (type == "Uint8Array") {
            current = U8;
            u8 = spawn<uint8_t>(x, len);
        } else if (type == "Int16Array") {
            current = I16;
            i16 = spawn<int16_t>(x, len);
        } else if (type == "Uint16Array") {
            current = U16;
            u16 = spawn<uint16_t>(x, len);
        } else if (type == "Int32Array") {
            current = I32;
            i32 = spawn<int32_t>(x, len);
        } else if (type == "Uint32Array") {
            current = U32;
            u32 = spawn<uint32_t>(x, len);
        } else if (type == "Int64Array") {
            current = I64;
            i64 = spawn<int64_t>(x, len);
        } else if (type == "Uint64Array") {
            current = U64;
            u64 = spawn<uint64_t>(x, len);
        } else if (type == "Float32Array") {
            current = F32;
            f32 = spawn<float>(x, len);
        } else if (type == "Float64Array") {
            current = F64;
            f64 = spawn<double>(x, len);
        } else {
            throw std::runtime_error("unknown array type '" + type + "'");
        }
        return;
    }

    enum IntType { I8, U8, I16, U16, I32, U32, I64, U64, F32, F64 };

    IntType current;
    size_t len;
    tatami::NakedArray<int8_t> i8;
    tatami::NakedArray<uint8_t> u8;
    tatami::NakedArray<int16_t> i16;
    tatami::NakedArray<uint16_t> u16;
    tatami::NakedArray<int32_t> i32;
    tatami::NakedArray<uint32_t> u32;
    tatami::NakedArray<int64_t> i64;
    tatami::NakedArray<uint64_t> u64;
    tatami::NakedArray<float> f32;
    tatami::NakedArray<double> f64;

    template<typename X>
    static tatami::NakedArray<X> spawn(uintptr_t ptr, size_t len) {
        return tatami::NakedArray<X>(reinterpret_cast<const X*>(ptr), len);
    }

public:
    T operator[](size_t i) const {
        switch (current) {
            case I8:
                return i8[i];
            case U8:
                return u8[i];
            case I16:
                return i16[i];
            case U16:
                return u16[i];
            case I32:
                return i32[i];
            case U32:
                return u32[i];
            case I64:
                return i64[i];
            case U64:
                return u64[i];
            case F32:
                return f32[i];
            case F64:
                return f64[i];
        }
    }

    size_t size() const {
        return len;
    }

public:
    struct Iterator {
        Iterator() : parent(NULL), index(0) {}

        Iterator(const SuperNakedArray* p, size_t i) : parent(p), index(i) {}

        const SuperNakedArray* parent;
        size_t index;

    public:
        T operator*() const {
            return (*parent)[index];
        }

        T operator[](size_t i) const {
            return (*parent)[index + i];
        }

    public:
        bool operator==(const Iterator& right) const {
            return index == right.index;
        }

        bool operator!=(const Iterator& right) const {
            return !(*this == right);
        }

        bool operator<(const Iterator& right) const {
            return index < right.index;
        }

        bool operator>=(const Iterator& right) const {
            return !(*this < right);
        }

        bool operator>(const Iterator& right) const {
            return index > right.index;
        }

        bool operator<=(const Iterator& right) const {
            return !(*this > right);
        }

    public:
        Iterator& operator+=(size_t n) {
            index += n;
            return *this;
        }

        Iterator& operator++() {
            *this += 1;
            return *this;
        }

        Iterator operator++(int) {
            auto copy = *this;
            ++(*this);
            return copy;
        }

        Iterator& operator-=(size_t n) {
            index -= n;
            return *this;
        }

        Iterator& operator--() {
            *this -= 1;
            return *this;
        }

        Iterator operator--(int) {
            auto copy = *this;
            --(*this);
            return copy;
        }

    public:
        Iterator operator+(size_t n) const {
            return Iterator(parent, index + n);
        }

        Iterator operator-(size_t n) const {
            return Iterator(parent, index - n);
        }

        friend Iterator operator+(size_t n, const Iterator& it) {
            return Iterator(it.parent, it.index + n);
        }

        ptrdiff_t operator-(const Iterator& right) const {
            ptrdiff_t out;
            if (right.index > index) {
                out = right.index - index;
                out *= -1;
            } else {
                out = index - right.index;
            }
            return out;
        }

    public:
        // Tags to pretend it's an iterator, at least enough for tatami to work.
        using iterator_category = std::random_access_iterator_tag;
        using difference_type = std::ptrdiff_t;
        using value_type = T;
        using pointer = const T*;  
        using reference = const T&; 
    };

    Iterator begin() const {
        return Iterator(this, 0);
    }

    Iterator end() const {
        return Iterator(this, this->size());
    }
};

/**
 * @param nrows Number of rows.
 * @param ncols Number of columns.
 * @param[in] values Offset to an integer array of length `nrows*ncols` containing the contents of the matrix.
 * @param type Type of the `values` array, as the name of a TypedArray subclass.
 *
 * @return A `NumericMatrix` containing a layered sparse matrix.
 */
NumericMatrix initialize_sparse_matrix_from_dense_vector(size_t nrows, size_t ncols, uintptr_t values, std::string type) {
    SuperNakedArray<int> vals(values, nrows*ncols, type);
    tatami::DenseColumnMatrix<double, int, decltype(vals)> mat(nrows, ncols, vals);
    auto output = tatami::convert_to_layered_sparse(&mat); 
    return NumericMatrix(std::move(output.matrix), std::move(output.permutation));
}

/**
 * @param nrows Number of rows.
 * @param ncols Number of columns.
 * @param nelements Number of non-zero elements.
 * @param[in] values Offset to an integer array of length `nelements` containing the values of the non-zero elements.
 * @param value_type Type of the `values` array, as the name of a TypedArray subclass.
 * @param[in] indices Offset to an integer array of length `nelements` containing the indices of the non-zero elements.
 * @param index_type Type of the `indices` array, as the name of a TypedArray subclass.
 * @param[in] indptrs Offset to an integer array of length `nelements` containing the index pointers for each row/column in the compressed sparse format.
 * @param indptr_type Type of the `indptrs` array, as the name of a TypedArray subclass.
 * @param csc Are the inputs in column-sparse compressed format?
 *
 * @return A `NumericMatrix` containing a layered sparse matrix.
 */
NumericMatrix initialize_sparse_matrix(size_t nrows, size_t ncols, size_t nelements, 
    uintptr_t values, std::string value_type,
    uintptr_t indices, std::string index_type,
    uintptr_t indptrs, std::string indptr_type,
    bool csc)
{
    SuperNakedArray<int> val(values, nelements, value_type);
    SuperNakedArray<int> idx(indices, nelements, index_type);
    SuperNakedArray<size_t> ind(indptrs, nelements, indptr_type);

    std::shared_ptr<tatami::Matrix<double, int> > mat; 
    if (csc) {
        mat.reset(new tatami::CompressedSparseColumnMatrix<double, int, decltype(val), decltype(idx), decltype(ind)>(nrows, ncols, val, idx, ind));
    } else {
        mat.reset(new tatami::CompressedSparseRowMatrix<double, int, decltype(val), decltype(idx), decltype(ind)>(nrows, ncols, val, idx, ind));
    }

    auto output = tatami::convert_to_layered_sparse(mat.get()); 
    return NumericMatrix(std::move(output.matrix), std::move(output.permutation));
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(initialize_sparse_matrix) {
    emscripten::function("initialize_sparse_matrix", &initialize_sparse_matrix);

    emscripten::function("initialize_sparse_matrix_from_dense_vector", &initialize_sparse_matrix_from_dense_vector);
}
/**
 * @endcond
 */
