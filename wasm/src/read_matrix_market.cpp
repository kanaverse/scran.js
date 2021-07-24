#include <emscripten/bind.h>

#include "NumericMatrix.h"
#include "tatami/ext/MatrixMarket.hpp"
#include <string>
#include <iostream>

template<typename T = double, typename IDX = int>
tatami::MatrixMarket::LayeredMatrixData<T, IDX> load_layered_sparse_matrix_from_buffer(const char* buffer, size_t len) {
    auto process = [&](auto& obj) -> void {
        size_t counter = 0;
        auto copy = buffer;
        while (counter < len) {
            auto processed = obj.add(copy, len);
            counter += processed;
            copy += processed;
        }
    };

    tatami::MatrixMarket::LineAssignments ass;
    process(ass);
    ass.finish();

    tatami::MatrixMarket::LayeredMatrixData<T, IDX> output;
    output.permutation = ass.permutation;

    constexpr size_t max16 = std::numeric_limits<uint16_t>::max();
    if (ass.nrows > max16) {
        tatami::MatrixMarket::LayeredBuilder<uint16_t> builder(std::move(ass));
        process(builder);
        output.matrix = builder.template finish<T, IDX>();
    } else {
        tatami::MatrixMarket::LayeredBuilder<IDX> builder(std::move(ass));
        process(builder);
        output.matrix = builder.template finish<T, IDX>();
    }

    return output;
}


// Stolen from 'inf()' at http://www.zlib.net/zpipe.c,
// with some shuffling of code to make it a bit more C++-like.
struct Unzlibber {
    struct ZStream {
        ZStream() {
            /* allocate inflate state */
            strm.zalloc = Z_NULL;
            strm.zfree = Z_NULL;
            strm.opaque = Z_NULL;
            strm.avail_in = 0;
            strm.next_in = Z_NULL;

            // https://stackoverflow.com/questions/1838699/how-can-i-decompress-a-gzip-stream-with-zlib
            int ret = inflateInit2(&strm, 16+MAX_WBITS); 
            if (ret != Z_OK) {
                throw 1;
            }
        }

        ~ZStream() {
            (void)inflateEnd(&strm);
            return;
        }

        // Delete the remaining constructors.
        ZStream(const ZStream&) = delete;
        ZStream(ZStream&&) = delete;
        ZStream& operator=(const ZStream&) = delete;
        ZStream& operator=(ZStream&&) = delete;

        z_stream strm;
    };

    template<class OBJECT>
    void operator()(unsigned char* buffer, size_t len, OBJECT& obj) {
        int bufsize = 262144;
        std::vector<unsigned char> output(bufsize + 1); // enough a safety NULL at EOF, see below.

        ZStream zstr;
        zstr.strm.avail_in = len;
        zstr.strm.next_in = buffer;

        size_t leftovers = 0;
        int ret = 0;

        /* run inflate() on input until output buffer not full */
        do {
            zstr.strm.avail_out = bufsize - leftovers;
            zstr.strm.next_out = output.data() + leftovers;
            ret = inflate(&(zstr.strm), Z_NO_FLUSH);
            assert(ret != Z_STREAM_ERROR);  /* state not clobbered */

            switch (ret) {
            case Z_NEED_DICT:
                ret = Z_DATA_ERROR; /* and fall through */
            case Z_DATA_ERROR:
            case Z_MEM_ERROR:
                throw 1;
            }

            size_t current_stored = bufsize - zstr.strm.avail_out;

            // Making sure we have a terminating newline.
            if (ret == Z_STREAM_END && current_stored && output[current_stored-1]!='\n') {
                output[current_stored] = '\n';
                ++current_stored;
            }

            // Adding whole lines.
            size_t last_processed = 0, total_processed = 0;
            do {
                last_processed = obj.add((char*)output.data() + total_processed, current_stored - total_processed);
                total_processed += last_processed;
            } while (last_processed);

            // Rotating what's left to the front for the next cycle.
            leftovers = current_stored - total_processed;
            for (size_t i = 0; i < leftovers; ++i) {
                output[i] = output[total_processed + i];
            }

            std::cout << "WHEE" << std::endl;
            std::cout << zstr.strm.avail_out << std::endl;
        } while (zstr.strm.avail_out == 0);

        /* clean up and return */
        if (ret != Z_STREAM_END) {
            throw 1;
        }
        return;
    }
};

template<typename T = double, typename IDX = int>
tatami::MatrixMarket::LayeredMatrixData<T, IDX> load_layered_sparse_matrix_gzip_from_buffer(unsigned char * buffer, size_t len) {
    Unzlibber unz;
    tatami::MatrixMarket::LineAssignments ass;
    unz(buffer, len, ass);
    ass.finish();

    tatami::MatrixMarket::LayeredMatrixData<T, IDX> output;
    output.permutation = ass.permutation;

    constexpr size_t max16 = std::numeric_limits<uint16_t>::max();
    if (ass.nrows > max16) {
        tatami::MatrixMarket::LayeredBuilder<uint16_t> builder(std::move(ass));
        unz(buffer, len, builder);
        output.matrix = builder.template finish<T, IDX>();
    } else {
        tatami::MatrixMarket::LayeredBuilder<IDX> builder(std::move(ass));
        unz(buffer, len, builder);
        output.matrix = builder.template finish<T, IDX>();
    }

    return output;
}

NumericMatrix read_matrix_market(uintptr_t buffer, int size, bool compressed) {
    auto process = [&](auto& stuff) {
        NumericMatrix output(std::move(stuff.matrix));
        output.permutation = stuff.permutation;
        return output;
    };

    if (compressed) {
        unsigned char* bufptr = reinterpret_cast<unsigned char*>(buffer);
        auto stuff = load_layered_sparse_matrix_gzip_from_buffer(bufptr, size);
        return process(stuff);
    } else {
        const char* bufptr = reinterpret_cast<const char*>(buffer);
        auto stuff = load_layered_sparse_matrix_from_buffer(bufptr, size);
        return process(stuff);
    }
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(read_matrix_market) {
    emscripten::function("read_matrix_market", &read_matrix_market);
}
/**
 * @endcond
 */
